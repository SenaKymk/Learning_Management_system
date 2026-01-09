import {
  ApiRequestError,
  approveEnrollment,
  checkSeb,
  clearToken,
  cloneCourse,
  createCourse,
  createCourseQuestion,
  createExamResult,
  fetchCourse,
  fetchCourseQuestions,
  fetchCourseStudentsByStatus,
  fetchCourses,
  fetchEnrollmentStatus,
  fetchExamResults,
  fetchMyExamResult,
  fetchMyGrades,
  fetchRandomCourseQuestions,
  fetchAdminMetrics,
  getPresignedUrl,
  getProfile,
  getToken,
  getUserRole,
  login,
  registerUser,
  reorderModules,
  rejectEnrollment,
  requestEnrollment,
  setCourseGrade,
  submitCourseExam,
  updateCourseMaterial,
  updateProfile,
  uploadFile,
  type CourseDetail,
  type CourseStudent,
  type EnrollmentStatus,
  type GradeEntry,
  type GradeSource,
  type QuestionBank,
  type QuestionSource,
  type UserProfile,
  type UserRole
} from "./api.js";
import { getLocale, setLocale, t } from "./i18n.js";

const appRoot = document.querySelector<HTMLDivElement>("#app");
let renderNonce = 0;
let activeMediaStream: MediaStream | null = null;
const preferredCameraKeywords = ["integrated", "built-in", "internal", "hd", "webcam"];
const excludedCameraKeywords = [
  "phone",
  "tablet",
  "virtual",
  "obs",
  "droidcam",
  "link",
  "epoccam"
];

function pickPreferredCameraDevice(devices: MediaDeviceInfo[]) {
  const videoDevices = devices.filter((device) => device.kind === "videoinput");
  const scored = videoDevices
    .map((device) => {
      const label = device.label.toLowerCase();
      const excluded = excludedCameraKeywords.some((keyword) => label.includes(keyword));
      const preferredScore = preferredCameraKeywords.reduce(
        (score, keyword) => (label.includes(keyword) ? score + 1 : score),
        0
      );
      return { device, excluded, preferredScore };
    })
    .filter((item) => !item.excluded)
    .sort((a, b) => b.preferredScore - a.preferredScore);

  return scored[0]?.device ?? null;
}

type Route = {
  path: string;
  params: Record<string, string>;
};

function toHash(path: string) {
  if (path.startsWith("#")) {
    return path;
  }
  if (!path.startsWith("/")) {
    return `#/${path}`;
  }
  return `#${path}`;
}

function navigate(path: string) {
  window.location.hash = toHash(path);
}

function getRoute(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { path: "/", params: {} };
  }
  if (parts[0] === "courses" && parts[1]) {
    return { path: "/courses/:id", params: { id: parts[1] } };
  }
  return { path: `/${parts[0]}`, params: {} };
}

function requireAuth(routePath: string) {
  const openRoutes = new Set(["/", "/login", "/register"]);
  return !openRoutes.has(routePath);
}

function setHtml(html: string) {
  if (!appRoot) {
    return;
  }
  appRoot.innerHTML = html;
}

function layout(content: string, role: UserRole | null) {
  const locale = getLocale();
  return `
    <div class="layout">
      <header>
        <div class="header-inner">
          <a href="${toHash("/")}" data-link class="logo">LMS</a>
          <nav>
            <a href="${toHash("/courses")}" data-link>${t("courses")}</a>
            ${role === "ADMIN" ? `<a href="${toHash("/admin")}" data-link>${t("dashboard")}</a>` : ""}
            <a href="${toHash("/seb")}" data-link>SEB Check</a>
            <a href="${toHash("/profile")}" data-link>Profile</a>
            <div class="lang-toggle" data-action="toggle-language">
              <button type="button" data-lang="en" class="${locale === "en" ? "active" : ""}">EN</button>
              <button type="button" data-lang="tr" class="${locale === "tr" ? "active" : ""}">TR</button>
            </div>
            ${renderAuthActions(role)}
          </nav>
        </div>
      </header>
      <main>${content}</main>
    </div>
  `;
}

function renderAuthActions(role: UserRole | null) {
  if (!role) {
    return `<a href="${toHash("/login")}" data-link class="btn-secondary">${t("login")}</a>`;
  }

  return `
    <span class="badge">${role}</span>
    <button type="button" class="btn-secondary" data-action="logout">${t("logout")}</button>
  `;
}

function renderHome() {
  return `
    <div class="grid">
      <section class="grid">
        <p class="muted" style="letter-spacing:0.4em;text-transform:uppercase;font-size:12px;">
          Learning Platform
        </p>
        <h1 style="font-size:40px;max-width:640px;line-height:1.1;margin:0;">
          Organize courses, deliver exams, and keep learners on track.
        </h1>
        <p class="muted" style="max-width:520px;font-size:16px;">
          A focused LMS interface for instructors and students. Upload materials,
          run Safe Exam Browser checks, and access course content from one place.
        </p>
        <div class="split">
          <a href="${toHash("/courses")}" data-link class="btn">View Courses</a>
          <a href="${toHash("/login")}" data-link class="btn-secondary">Sign In</a>
        </div>
      </section>
      <section class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
        ${[
          {
            title: "Course Spaces",
            body: "Manage modules, content, and course materials in a single view."
          },
          {
            title: "Secure Exams",
            body: "Check Safe Exam Browser status before starting assessments."
          },
          {
            title: "Quick Uploads",
            body: "Attach materials to courses with one upload action."
          }
        ]
          .map(
            (card) => `
            <div class="card">
              <h3 style="margin-top:0;">${card.title}</h3>
              <p class="muted">${card.body}</p>
            </div>
          `
          )
          .join("")}
      </section>
    </div>
  `;
}

function renderLogin(state: { error: string | null; loading: boolean }) {
  return `
    <div class="grid" style="place-items:center;">
      <div class="card" style="max-width:420px;width:100%;">
        <h1 style="margin-top:0;">Welcome back</h1>
        <p class="muted">Sign in to manage courses and exams.</p>
        <form id="login-form" class="grid" style="margin-top:20px;">
          <label>Email
            <input type="email" name="email" required />
          </label>
          <label>Password
            <input type="password" name="password" required />
          </label>
          ${state.error ? `<p class="error">${state.error}</p>` : ""}
          <button type="submit" class="btn" ${state.loading ? "disabled" : ""}>
            ${state.loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p class="muted" style="margin-top:16px;font-size:13px;">
          New here?
          <a href="${toHash("/register")}" data-link class="link">Create a student account</a>
        </p>
      </div>
    </div>
  `;
}

function renderRegister(state: { error: string | null; success: string | null; loading: boolean }) {
  return `
    <div class="grid" style="place-items:center;">
      <div class="card" style="max-width:440px;width:100%;">
        <h1 style="margin-top:0;">Create student account</h1>
        <p class="muted">Fill in your details to request access.</p>
        <form id="register-form" class="grid" style="margin-top:20px;">
          <label>First name
            <input type="text" name="firstName" required />
          </label>
          <label>Last name
            <input type="text" name="lastName" required />
          </label>
          <label>Student number
            <input type="text" name="studentNumber" required />
          </label>
          <label>Email
            <input type="email" name="email" required />
          </label>
          <label>Password
            <input type="password" name="password" minlength="6" required />
          </label>
          ${state.error ? `<p class="error">${state.error}</p>` : ""}
          ${state.success ? `<p class="success">${state.success}</p>` : ""}
          <button type="submit" class="btn" ${state.loading ? "disabled" : ""}>
            ${state.loading ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  `;
}

function renderCoursesPage(state: {
  role: UserRole | null;
  error: string | null;
  loading: boolean;
  coursesHtml: string;
  showForm: boolean;
  formMessage: string | null;
  saving: boolean;
  cloneMode: boolean;
  cloneOptions: string;
  offline: boolean;
}) {
  return `
    <div class="grid">
      <div class="split" style="justify-content:space-between;align-items:center;">
        <div>
          <h1 style="margin:0;">${t("courses")}</h1>
          <p class="muted">Browse active courses and review materials.</p>
        </div>
        ${state.role === "ADMIN"
          ? `<button type="button" class="btn" data-action="toggle-course-form">
               ${state.showForm ? "Close" : "+ New Course"}
             </button>`
          : ""}
      </div>
      ${
        state.role === "ADMIN" && state.showForm
          ? `
          <div class="card">
            <form id="course-create-form" class="grid">
              <label class="checkbox-row">
                <input type="checkbox" name="cloneMode" ${state.cloneMode ? "checked" : ""} />
                Clone existing course
              </label>
              ${
                state.cloneMode
                  ? `
                  <label>Source course
                    <select name="cloneCourseId" required>
                      <option value="">Select a course</option>
                      ${state.cloneOptions}
                    </select>
                  </label>
                `
                  : `
              <label>Title
                <input type="text" name="title" required />
              </label>
              <label>Description
                <textarea name="description" rows="4"></textarea>
              </label>
              <div class="split">
                <label>Available from
                  <input type="datetime-local" name="availableFrom" />
                </label>
                <label>Available until
                  <input type="datetime-local" name="availableUntil" />
                </label>
              </div>
              `
              }
              <div class="split" style="align-items:center;">
                <button type="submit" class="btn" ${state.saving ? "disabled" : ""}>
                  ${state.saving ? "Working..." : state.cloneMode ? "Clone course" : "Create course"}
                </button>
                ${state.formMessage ? `<span class="muted">${state.formMessage}</span>` : ""}
              </div>
            </form>
          </div>
        `
          : ""
      }
      ${state.loading ? `<p class="muted">Loading...</p>` : ""}
      ${state.offline ? `<p class="warning">Offline mode: showing cached data.</p>` : ""}
      ${state.error ? `<p class="error">${state.error}</p>` : ""}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));">
        ${state.coursesHtml}
      </div>
    </div>
  `;
}

function renderCourseDetailPage(state: {
  course: CourseDetail | null;
  role: UserRole | null;
  error: string | null;
  saving: boolean;
  opening: boolean;
  enrollmentStatus: EnrollmentStatus;
  pendingStudents: CourseStudent[];
  enrolledStudents: CourseStudent[];
  grades: GradeEntry[];
  examResults: { userName: string; score: number | null }[];
  myExamResult: { calculatedScore: number | null } | null;
  activeTab: "modules" | "questions";
  moduleList: CourseDetail["modules"];
  pdfUrls: Record<string, string>;
  questionBank: QuestionBank[];
  randomQuestions: QuestionBank[];
  practiceResult: { score: number; total: number } | null;
  downloadId: string | null;
  downloadStatus: string | null;
  downloadProgress: number | null;
}) {
  if (!state.course) {
    return `<p class="muted">Loading...</p>`;
  }

  const course = state.course;
  const now = new Date();
  const availableFrom = course.availableFrom ? new Date(course.availableFrom) : null;
  const availableUntil = course.availableUntil ? new Date(course.availableUntil) : null;
  let availabilityLabel = "Available";
  let isAvailable = true;
  if (availableFrom && now < availableFrom) {
    availabilityLabel = "Not yet available";
    isAvailable = false;
  } else if (availableUntil && now > availableUntil) {
    availabilityLabel = "Expired";
    isAvailable = false;
  }
  return `
    <div class="grid">
      ${state.error ? `<p class="error">${state.error}</p>` : ""}
      <div class="card">
        <h1 style="margin-top:0;">${course.title}</h1>
        <p class="muted">${course.description ?? "No description available"}</p>
        ${
          course.prerequisite
            ? `<p class="warning">Prerequisite: ${course.prerequisite.title}. Enrollment is allowed, but completion is recommended.</p>`
            : ""
        }
        <div class="split" style="align-items:center;margin-top:16px;">
          <span class="badge">${course.materialKey ? "Material linked" : "Material missing"}</span>
          <span class="badge">${availabilityLabel}</span>
          ${
            state.role === "ADMIN"
              ? `
                <form id="material-upload-form" class="split" style="align-items:center;">
                  <input type="file" name="material" accept="application/pdf" />
                  <button type="submit" class="btn-secondary" ${state.saving ? "disabled" : ""}>
                    ${state.saving ? "Uploading..." : "Upload material"}
                  </button>
                </form>
              `
              : ""
          }
          ${
            state.role === "STUDENT" && course.materialKey
              ? `<button type="button" class="btn-secondary" data-action="view-material" ${
                  state.opening ? "disabled" : ""
                }>${state.opening ? "Opening..." : "View Material"}</button>`
              : ""
          }
          ${
            course.materialKey
              ? `<button type="button" class="btn-secondary" data-action="download-material">Download Material</button>`
              : ""
          }
          ${state.saving ? `<span class="muted">Updating...</span>` : ""}
        </div>
        ${
          state.downloadStatus
            ? `<p class="muted" style="margin-top:12px;">Download: ${state.downloadStatus}${
                state.downloadProgress !== null ? ` (${state.downloadProgress}%)` : ""
              }</p>`
            : ""
        }
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Students</h2>
        <p class="muted">
          Enrollment management and status. Some exams may require Safe Exam Browser.
        </p>
        ${
          state.role === "ADMIN"
            ? renderStudentsTable(state.pendingStudents, state.enrolledStudents)
            : renderEnrollmentStatus(state.enrollmentStatus, isAvailable)
        }
      </div>

      <div class="card">
        <h2 style="margin-top:0;">Results</h2>
        <p class="muted">OMR-ready results view. Some exams may require Safe Exam Browser.</p>
        ${
          state.role === "ADMIN"
            ? renderAdminResults(state.enrolledStudents, state.examResults)
            : renderStudentResults(state.grades, course.id, state.myExamResult)
        }
      </div>

      <div class="split">
        <button type="button" class="${state.activeTab === "modules" ? "btn" : "btn-secondary"}" data-action="tab-modules">
          ${t("modules")}
        </button>
        <button type="button" class="${state.activeTab === "questions" ? "btn" : "btn-secondary"}" data-action="tab-questions">
          ${t("questions")}
        </button>
      </div>

      ${
        state.activeTab === "modules"
          ? renderModulesSection(state.moduleList, state.role, state.pdfUrls)
          : renderQuestionsSection(state.role, course, state.moduleList, state.questionBank, state.randomQuestions, state.practiceResult)
      }
    </div>
  `;
}

function renderStudentsTable(pending: CourseStudent[], enrolled: CourseStudent[]) {
  return `
    <div class="grid" style="margin-top:16px;">
      <div class="card" style="background:rgba(10,15,25,0.55);">
        <h3 style="margin-top:0;">Pending requests</h3>
        <div style="overflow:auto;">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                pending.length === 0
                  ? `<tr><td class="muted" colspan="2">No pending requests.</td></tr>`
                  : pending
                      .map(
                        (student) => `
                          <tr>
                            <td>${student.firstName} ${student.lastName}</td>
                            <td>
                              <div class="split">
                                <button type="button" class="btn-secondary" data-action="approve-enrollment" data-enrollment="${
                                  student.enrollmentId
                                }">Approve</button>
                                <button type="button" class="btn-secondary" data-action="reject-enrollment" data-enrollment="${
                                  student.enrollmentId
                                }">Reject</button>
                              </div>
                            </td>
                          </tr>
                        `
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="card" style="background:rgba(10,15,25,0.55);">
        <h3 style="margin-top:0;">Enrolled students</h3>
        <div style="overflow:auto;">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${
                enrolled.length === 0
                  ? `<tr><td class="muted" colspan="3">No enrolled students yet.</td></tr>`
                  : enrolled
                      .map(
                        (student) => `
                          <tr>
                            <td>${student.firstName} ${student.lastName}</td>
                            <td>
                              <div class="split" style="align-items:center;">
                                <input type="number" min="0" max="100" value="${
                                  student.score ?? ""
                                }" data-grade="${student.userId}" style="max-width:90px;" />
                                <button type="button" class="btn-secondary" data-action="save-grade" data-user="${
                                  student.userId
                                }">Save</button>
                              </div>
                            </td>
                            <td>
                              <select data-source="${student.userId}">
                                ${["MANUAL", "OMR", "EXAM"]
                                  .map(
                                    (source) =>
                                      `<option value="${source}" ${
                                        (student.source ?? "MANUAL") === source ? "selected" : ""
                                      }>${source}</option>`
                                  )
                                  .join("")}
                              </select>
                            </td>
                          </tr>
                        `
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderEnrollmentStatus(status: EnrollmentStatus, isAvailable: boolean) {
  if (status === "ENROLLED") {
    return `<p class="success">You are enrolled in this course.</p>`;
  }
  if (status === "PENDING") {
    return `<p class="muted">Enrollment request pending.</p>`;
  }
  if (status === "REJECTED") {
    return `<p class="error">Enrollment request rejected.</p>`;
  }
  if (!isAvailable) {
    return `<p class="muted">Course is not currently available.</p>`;
  }
  return `
    <button type="button" class="btn-secondary" data-action="request-enrollment">
      Request to join this course
    </button>
  `;
}

function renderAdminResults(students: CourseStudent[], examResults: { userName: string; score: number | null }[]) {
  return `
    <div class="grid" style="margin-top:16px;">
      <div style="overflow:auto;">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Source</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${
              students.length === 0
                ? `<tr><td class="muted" colspan="3">No grades available.</td></tr>`
                : students
                    .map(
                      (row) => `
                        <tr>
                          <td>${row.firstName} ${row.lastName}</td>
                          <td>${row.source ?? "-"}</td>
                          <td>${row.score ?? "-"}</td>
                        </tr>
                      `
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
      <div class="card" style="background:rgba(10,15,25,0.55);">
        <h3 style="margin-top:0;">Exam Results (OMR)</h3>
        <form id="exam-result-form" class="split" style="margin-bottom:16px;align-items:flex-end;">
          <label>Student
            <select name="studentId" required>
              <option value="">Select student</option>
              ${students
                .map(
                  (student) => `<option value="${student.userId}">${student.firstName} ${student.lastName}</option>`
                )
                .join("")}
            </select>
          </label>
          <label>Calculated score
            <input type="number" name="score" min="0" />
          </label>
          <button type="submit" class="btn-secondary">Create result</button>
        </form>
        <div style="overflow:auto;">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Calculated score</th>
              </tr>
            </thead>
            <tbody>
              ${
                examResults.length === 0
                  ? `<tr><td class="muted" colspan="2">No exam results recorded.</td></tr>`
                  : examResults
                      .map(
                        (result) => `
                          <tr>
                            <td>${result.userName}</td>
                            <td>${result.score ?? "-"}</td>
                          </tr>
                        `
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderStudentResults(grades: GradeEntry[], courseId: string, examResult: { calculatedScore: number | null } | null) {
  const filtered = grades.filter((grade) => grade.courseId === courseId);
  return `
    <div class="stack" style="margin-top:16px;">
      ${
        filtered.length === 0
          ? `<p class="muted">No grades available yet.</p>`
          : filtered
              .map(
                (result) => `
                  <div class="card" style="background:rgba(10,15,25,0.7);">
                    <div class="split" style="justify-content:space-between;">
                      <div>
                        <p class="muted">${result.courseTitle}</p>
                        <strong>Course Grade</strong>
                        <p class="muted" style="font-size:12px;">Source: ${result.source}</p>
                      </div>
                      <span class="badge">${result.score ?? "Not graded yet"}</span>
                    </div>
                  </div>
                `
              )
              .join("")
      }
      <div class="card" style="background:rgba(10,15,25,0.7);">
        <div class="split" style="justify-content:space-between;">
          <div>
            <p class="muted">OMR / Exam result</p>
            <strong>Calculated score</strong>
          </div>
          <span class="badge">${examResult?.calculatedScore ?? "Not graded yet"}</span>
        </div>
      </div>
    </div>
  `;
}

function renderModulesSection(
  modules: CourseDetail["modules"],
  role: UserRole | null,
  pdfUrls: Record<string, string>
) {
  return `
    <div class="grid">
      ${
        modules.length === 0
          ? `<p class="muted">No modules yet.</p>`
          : modules
              .map(
                (module) => `
                    <div class="card" draggable="${role === "ADMIN"}" data-module="${module.id}">
                      <div class="split" style="justify-content:space-between;align-items:center;">
                        <h3 style="margin:0;">${module.title}</h3>
                        <span class="muted">Order ${module.order}</span>
                      </div>
                      <div class="stack" style="margin-top:16px;">
                        ${
                          module.contents.length === 0
                            ? `<p class="muted">No content yet.</p>`
                            : module.contents
                                .map(
                                  (content) => `
                                    <div class="card" style="background:rgba(10,15,25,0.7);">
                                      <strong>${content.title}</strong>
                                      ${renderContent(content, pdfUrls)}
                                    </div>
                                  `
                                )
                                .join("")
                        }
                      </div>
                    </div>
                  `
              )
              .join("")
      }
    </div>
  `;
}

function renderQuestionsSection(
  role: UserRole | null,
  course: CourseDetail,
  modules: CourseDetail["modules"],
  questionBank: QuestionBank[],
  randomQuestions: QuestionBank[],
  practiceResult: { score: number; total: number } | null
) {
  if (role === "ADMIN") {
    return `
      <div class="grid">
        <div class="card">
          <h2 style="margin-top:0;">Add question</h2>
          <form id="question-create-form" class="grid">
            <label>Question text
              <textarea name="text" rows="4" required></textarea>
            </label>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
              ${[0, 1, 2, 3]
                .map(
                  (index) => `
                    <label>Option ${index + 1}
                      <input type="text" name="option-${index}" required />
                    </label>
                  `
                )
                .join("")}
            </div>
            <div class="split">
              <label>Correct answer index
                <input type="number" min="0" max="3" name="answer" value="0" required />
              </label>
              <label>Source
                <select name="source">
                  <option value="PDF">PDF</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>
              <label>Module (optional)
                <select name="moduleId">
                  <option value="">No module</option>
                  ${modules.map((module) => `<option value="${module.id}">${module.title}</option>`).join("")}
                </select>
              </label>
            </div>
            <button type="submit" class="btn">Add question</button>
          </form>
        </div>
        <div class="card">
          <h2 style="margin-top:0;">Question bank</h2>
          <div class="stack">
            ${
              questionBank.length === 0
                ? `<p class="muted">No questions yet.</p>`
                : questionBank
                    .map(
                      (question, index) => `
                        <div class="card" style="background:rgba(10,15,25,0.7);">
                          <p class="muted">Question ${index + 1}</p>
                          <strong>${question.text}</strong>
                          <p class="muted" style="font-size:12px;">Source: ${question.source}</p>
                        </div>
                      `
                    )
                    .join("")
            }
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="split" style="justify-content:space-between;align-items:center;">
        <div>
          <h2 style="margin-top:0;">Practice questions</h2>
          <p class="muted">Pull a random set and submit for automatic grading.</p>
        </div>
        <button type="button" class="btn" data-action="load-random-questions">Load random questions</button>
      </div>
      <div class="stack" style="margin-top:16px;">
        ${
          randomQuestions.length === 0
            ? `<p class="muted">No questions loaded yet.</p>`
            : randomQuestions
                .map(
                  (question, index) => `
                    <div class="card" style="background:rgba(10,15,25,0.7);">
                      <p class="muted">Question ${index + 1}</p>
                      <strong>${question.text}</strong>
                      <p class="muted" style="font-size:12px;">Source: ${question.source}</p>
                      <div class="stack" style="margin-top:12px;">
                        ${question.options
                          .map(
                            (option, optionIndex) => `
                              <label class="radio-row">
                                <input type="radio" name="question-${question.id}" value="${optionIndex}" />
                                <span>${option}</span>
                              </label>
                            `
                          )
                          .join("")}
                      </div>
                    </div>
                  `
                )
                .join("")
        }
      </div>
      ${
        randomQuestions.length > 0
          ? `
            <div class="split" style="margin-top:16px;align-items:center;">
              <button type="button" class="btn" data-action="submit-practice">${t("submit")}</button>
              ${practiceResult ? `<span class="badge">Score: ${practiceResult.score} / ${practiceResult.total}</span>` : ""}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderContent(
  content: { id?: string; type: string; title?: string; text?: string | null; url?: string | null; objectKey?: string | null },
  _pdfUrls: Record<string, string>
) {
  if (content.type === "TEXT") {
    return `<p class="muted">${content.text ?? ""}</p>`;
  }
  if (content.type === "LINK") {
    const link = content.url ?? "#";
    return `<a class="link" href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>`;
  }
  if (content.type === "VIDEO") {
    const link = content.url ?? "#";
    const youtubeMatch = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
    const vimeoMatch = link.match(/vimeo\.com\/(\d+)/i);
    const embed = youtubeMatch?.[1]
      ? `https://www.youtube.com/embed/${youtubeMatch[1]}`
      : vimeoMatch?.[1]
      ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
      : null;
    return embed
      ? `<iframe class="pdf-frame" src="${embed}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      : `<a class="link" href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>`;
  }
  if (content.type === "PDF") {
    return `
      <div class="stack" style="margin-top:8px;">
        <div class="split">
          <button type="button" class="btn-secondary" data-action="open-pdf" data-objectkey="${content.objectKey ?? ""}">
            Open in new window
          </button>
          <button type="button" class="btn-secondary" data-action="download-pdf" data-objectkey="${content.objectKey ?? ""}" data-title="${content.title ?? "material"}">
            Download
          </button>
        </div>
      </div>
    `;
  }
  return `<p class="muted">File: ${content.objectKey ?? "-"}</p>`;
}

function renderProfile(state: {
  profile: UserProfile | null;
  error: string | null;
  success: string | null;
  saving: boolean;
  offline: boolean;
}) {
  if (!state.profile) {
    return `<p class="muted">Loading...</p>`;
  }
  const profile = state.profile;
  return `
    <div class="grid" style="max-width:520px;">
      <div>
        <h1 style="margin:0;">Profile</h1>
        <p class="muted">Manage your personal information.</p>
        ${state.offline ? `<p class="warning">Offline mode: showing cached profile.</p>` : ""}
      </div>
      <div class="card">
        <form id="profile-form" class="grid">
          <label>Email
            <input type="email" name="email" value="${profile.email}" disabled />
          </label>
          <label>First name
            <input type="text" name="firstName" value="${profile.firstName ?? ""}" required />
          </label>
          <label>Last name
            <input type="text" name="lastName" value="${profile.lastName ?? ""}" required />
          </label>
          ${
            profile.role === "STUDENT"
              ? `
              <label>Student number
                <input type="text" name="studentNumber" value="${profile.studentNumber ?? ""}" required />
              </label>
            `
              : ""
          }
          ${state.error ? `<p class="error">${state.error}</p>` : ""}
          ${state.success ? `<p class="success">${state.success}</p>` : ""}
          <button type="submit" class="btn" ${state.saving ? "disabled" : ""}>
            ${state.saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  `;
}

function renderResults(state: { role: UserRole | null; grades: GradeEntry[]; error: string | null }) {
  return `
    <div class="grid">
      <div>
        <h1 style="margin:0;">My Results</h1>
        <p class="muted">Your latest exam performance.</p>
      </div>
      ${
        state.role !== "STUDENT"
          ? `<div class="card"><p class="muted">Results are available for students only.</p></div>`
          : `
            <div class="grid">
              ${state.error ? `<p class="error">${state.error}</p>` : ""}
              ${
                state.grades.length === 0
                  ? `<p class="muted">No grades available yet.</p>`
                  : state.grades
                      .map(
                        (result) => `
                          <div class="card">
                            <div class="split" style="justify-content:space-between;">
                      <div>
                        <p class="muted">${result.courseTitle}</p>
                        <h3 style="margin:4px 0 0;">Course Grade</h3>
                        <p class="muted" style="font-size:12px;">Source: ${result.source}</p>
                      </div>
                      <span class="badge">${result.score ?? "Not graded yet"}</span>
                    </div>
                  </div>
                `
                      )
                      .join("")
              }
            </div>
          `
      }
    </div>
  `;
}

function renderAdminDashboard(state: {
  role: UserRole | null;
  error: string | null;
  metrics: {
    totalCourses: number;
    totalStudents: number;
    totalEnrolledStudents: number;
    averageGrade: number | null;
  } | null;
}) {
  return `
    <div class="grid">
      <div>
        <h1 style="margin:0;">${t("dashboard")}</h1>
        <p class="muted">Live course and enrollment metrics.</p>
      </div>
      ${
        state.role !== "ADMIN"
          ? `<div class="card"><p class="muted">You do not have access to this page.</p></div>`
          : `
            ${state.error ? `<p class="error">${state.error}</p>` : ""}
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
              <div class="card">
                <p class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:0.2em;">Courses</p>
                <h2 style="margin:8px 0 0;">${state.metrics ? state.metrics.totalCourses : "-"}</h2>
              </div>
              <div class="card">
                <p class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:0.2em;">Students</p>
                <h2 style="margin:8px 0 0;">${state.metrics ? state.metrics.totalStudents : "-"}</h2>
              </div>
              <div class="card">
                <p class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:0.2em;">Enrolled</p>
                <h2 style="margin:8px 0 0;">${state.metrics ? state.metrics.totalEnrolledStudents : "-"}</h2>
              </div>
              <div class="card">
                <p class="muted" style="text-transform:uppercase;font-size:11px;letter-spacing:0.2em;">Average grade</p>
                <h2 style="margin:8px 0 0;">${
                  state.metrics && state.metrics.averageGrade !== null
                    ? state.metrics.averageGrade.toFixed(1)
                    : "-"
                }</h2>
              </div>
            </div>
          `
      }
    </div>
  `;
}

type SebStatus = "loading" | "ok" | "blocked";

function renderSeb(state: {
  status: SebStatus;
  error: string | null;
  role: UserRole | null;
  mediaStatus: "idle" | "granted" | "error";
  mediaError: string | null;
}) {
  return `
    <div class="grid">
      <div>
        <h1 style="margin:0;">Safe Exam Browser</h1>
        <p class="muted">Your exam session requires Safe Exam Browser to proceed.</p>
      </div>
      <div class="card">
        ${state.role === "STUDENT" ? `<p class="muted">Students must verify SEB status before starting an exam.</p>` : ""}
        ${state.status === "loading" ? `<p class="muted">Checking SEB status...</p>` : ""}
        ${state.status === "ok" ? `<p class="success">Safe Exam Browser detected. You may start the exam.</p>` : ""}
        ${state.status === "blocked" ? `<p class="error">This exam requires Safe Exam Browser.</p>` : ""}
        ${state.error ? `<p class="error">${state.error}</p>` : ""}
      </div>
      <div class="card">
        <h2 style="margin-top:0;">Camera & Microphone Test</h2>
        <p class="muted">Check device availability for proctored sessions.</p>
        <div class="split" style="align-items:center;">
          <button type="button" class="btn-secondary" data-action="test-media">Test Camera & Microphone</button>
          ${
            state.mediaStatus === "granted"
              ? `<span class="badge" style="background:rgba(34,197,94,0.2);color:#bbf7d0;">Camera and microphone access granted</span>`
              : ""
          }
        </div>
        ${state.mediaStatus === "error" && state.mediaError ? `<p class="error">${state.mediaError}</p>` : ""}
        <video id="media-preview" autoplay muted playsinline class="media-preview"></video>
      </div>
    </div>
  `;
}

async function renderRoute() {
  const nonce = ++renderNonce;
  const route = getRoute();
  const role = getUserRole();
  const token = getToken();

  if (requireAuth(route.path) && !token) {
    navigate("/login");
    return;
  }

  if ((route.path === "/login" || route.path === "/register") && token) {
    navigate("/courses");
    return;
  }

  if (route.path === "/") {
    setHtml(layout(renderHome(), role));
    bindSharedHandlers();
    return;
  }

  if (route.path === "/login") {
    let state = { error: null as string | null, loading: false };
    const render = () => {
      setHtml(layout(renderLogin(state), role));
      bindSharedHandlers();
      const form = document.querySelector<HTMLFormElement>("#login-form");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          state = { error: null, loading: true };
          render();
          try {
            await login(String(data.get("email") || ""), String(data.get("password") || ""));
            navigate("/courses");
          } catch (err) {
            if (err instanceof ApiRequestError) {
              if (err.isNetwork) {
                state = { error: "Backend unreachable", loading: false };
              } else if (err.status === 401) {
                state = { error: "Invalid credentials", loading: false };
              } else {
                state = { error: err.message || "Login failed", loading: false };
              }
            } else {
              state = { error: "Login failed", loading: false };
            }
            render();
          }
        });
      }
    };
    render();
    return;
  }

  if (route.path === "/register") {
    let state = { error: null as string | null, success: null as string | null, loading: false };
    const render = () => {
      setHtml(layout(renderRegister(state), role));
      bindSharedHandlers();
      const form = document.querySelector<HTMLFormElement>("#register-form");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          state = { error: null, success: null, loading: true };
          render();
          try {
            await registerUser({
              email: String(data.get("email") || ""),
              password: String(data.get("password") || ""),
              firstName: String(data.get("firstName") || ""),
              lastName: String(data.get("lastName") || ""),
              studentNumber: String(data.get("studentNumber") || "")
            });
            state = { error: null, success: "Registration complete. You can sign in now.", loading: false };
            render();
            setTimeout(() => navigate("/login"), 800);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Registration failed";
            state = { error: message, success: null, loading: false };
            render();
          }
        });
      }
    };
    render();
    return;
  }

  if (route.path === "/courses") {
    let state = {
      role,
      error: null as string | null,
      loading: true,
      coursesHtml: "",
      showForm: false,
      formMessage: null as string | null,
      saving: false,
      cloneMode: false,
      cloneOptions: "",
      offline: false
    };

    const render = () => {
      setHtml(layout(renderCoursesPage(state), role));
      bindSharedHandlers();
      const toggleBtn = document.querySelector<HTMLButtonElement>("[data-action='toggle-course-form']");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          state.showForm = !state.showForm;
          state.formMessage = null;
          render();
        });
      }

      const form = document.querySelector<HTMLFormElement>("#course-create-form");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          state.saving = true;
          state.formMessage = null;
          render();
          try {
            if (state.cloneMode) {
              const cloneCourseId = String(data.get("cloneCourseId") || "");
              if (!cloneCourseId) {
                throw new Error("Select a course to clone.");
              }
              await cloneCourse(cloneCourseId);
            } else {
              const availableFrom = String(data.get("availableFrom") || "") || undefined;
              const availableUntil = String(data.get("availableUntil") || "") || undefined;
              await createCourse(
                String(data.get("title") || ""),
                String(data.get("description") || "") || undefined,
                {
                  availableFrom,
                  availableUntil
                }
              );
            }
            state.saving = false;
            state.formMessage = "Course created successfully";
            state.showForm = false;
            render();
            await loadCourses();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create course";
            state.saving = false;
            state.formMessage = message;
            render();
          }
        });
      }
      const cloneToggle = form?.querySelector<HTMLInputElement>("input[name='cloneMode']");
      if (cloneToggle) {
        cloneToggle.addEventListener("change", (event) => {
          state.cloneMode = (event.target as HTMLInputElement).checked;
          render();
        });
      }
    };

    const loadCourses = async () => {
      try {
        const data = await fetchCourses();
        if (nonce !== renderNonce) {
          return;
        }
        window.localStorage.setItem("cache:courses", JSON.stringify(data));
        state.offline = false;
        state.coursesHtml = data
          .map(
            (course) => `
              <a href="${toHash(`/courses/${course.id}`)}" data-link class="card">
                <div class="split" style="justify-content:space-between;">
                  <div>
                    <h3 style="margin:0;">${course.title}</h3>
                    <p class="muted">${course.description ?? "No description provided"}</p>
                  </div>
                  <span class="badge">${course.materialKey ? "Material linked" : "No material"}</span>
                </div>
              </a>
            `
          )
          .join("");
        state.cloneOptions = data
          .map((course) => `<option value="${course.id}">${course.title}</option>`)
          .join("");
        state.loading = false;
        render();
      } catch (err) {
        const cached = window.localStorage.getItem("cache:courses");
        if (cached) {
          const data = JSON.parse(cached) as Array<{ id: string; title: string; description?: string | null; materialKey?: string | null }>;
          state.coursesHtml = data
            .map(
              (course) => `
                <a href="${toHash(`/courses/${course.id}`)}" data-link class="card">
                  <div class="split" style="justify-content:space-between;">
                    <div>
                      <h3 style="margin:0;">${course.title}</h3>
                      <p class="muted">${course.description ?? "No description provided"}</p>
                    </div>
                    <span class="badge">${course.materialKey ? "Material linked" : "No material"}</span>
                  </div>
                </a>
              `
            )
            .join("");
          state.cloneOptions = data
            .map((course) => `<option value="${course.id}">${course.title}</option>`)
            .join("");
          state.offline = true;
          state.error = null;
          state.loading = false;
          render();
          return;
        }
        state.error = err instanceof Error ? err.message : "Failed to load courses";
        state.loading = false;
        render();
      }
    };

    render();
    void loadCourses();
    return;
  }

  if (route.path === "/courses/:id") {
    const courseId = route.params.id;
    let state = {
      course: null as CourseDetail | null,
      role,
      error: null as string | null,
      saving: false,
      opening: false,
      enrollmentStatus: "NOT_ENROLLED" as EnrollmentStatus,
      pendingStudents: [] as CourseStudent[],
      enrolledStudents: [] as CourseStudent[],
      grades: [] as GradeEntry[],
      examResults: [] as { userName: string; score: number | null }[],
      myExamResult: null as { calculatedScore: number | null } | null,
      activeTab: "modules" as "modules" | "questions",
      moduleList: [] as CourseDetail["modules"],
      pdfUrls: {} as Record<string, string>,
      questionBank: [] as QuestionBank[],
      randomQuestions: [] as QuestionBank[],
      practiceResult: null as { score: number; total: number } | null,
      downloadId: null as string | null,
      downloadStatus: null as string | null,
      downloadProgress: null as number | null
    };
    let downloadUnsubscribe: (() => void) | null = null;

    const render = () => {
      setHtml(layout(renderCourseDetailPage(state), role));
      bindSharedHandlers();

      const uploadForm = document.querySelector<HTMLFormElement>("#material-upload-form");
      if (uploadForm) {
        uploadForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const input = uploadForm.querySelector<HTMLInputElement>("input[type='file']");
          const file = input?.files?.[0];
          if (!file) {
            state.error = "Please select a file";
            render();
            return;
          }
          if (file.type !== "application/pdf") {
            state.error = "Only PDF files are allowed";
            render();
            return;
          }
          state.saving = true;
          state.error = null;
          render();
          try {
            const result = await uploadFile(file);
            await updateCourseMaterial(courseId, result.objectKey);
            await loadCourse();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to update material";
          } finally {
            state.saving = false;
            render();
          }
        });
      }

      const viewBtn = document.querySelector<HTMLButtonElement>("[data-action='view-material']");
      if (viewBtn) {
        viewBtn.addEventListener("click", async () => {
          if (!state.course?.materialKey) {
            return;
          }
          state.opening = true;
          state.error = null;
          render();
          try {
            const url = await getPresignedUrl(state.course.materialKey);
            window.open(url, "_blank", "noopener,noreferrer");
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to open material";
          } finally {
            state.opening = false;
            render();
          }
        });
      }

      const downloadBtn = document.querySelector<HTMLButtonElement>("[data-action='download-material']");
      if (downloadBtn) {
        downloadBtn.addEventListener("click", async () => {
          if (!state.course?.materialKey) {
            return;
          }
          state.downloadStatus = "Preparing download";
          state.downloadProgress = 0;
          render();
          try {
            const url = await getPresignedUrl(state.course.materialKey);
            const filename = `${state.course.title.replace(/[<>:"/\\\\|?*]/g, "_")}.pdf`;
            const result = await window.lms.download.start({ url, filename });
            if (!result.ok) {
              throw new Error(result.error);
            }
            state.downloadId = result.downloadId;
            state.downloadStatus = "Starting...";
            render();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to start download";
            state.downloadStatus = "Failed";
            render();
          }
        });
      }

      const requestBtn = document.querySelector<HTMLButtonElement>("[data-action='request-enrollment']");
      if (requestBtn) {
        requestBtn.addEventListener("click", async () => {
          state.error = null;
          render();
          try {
            const response = await requestEnrollment(courseId);
            state.enrollmentStatus = response.status;
            if (response.warning) {
              state.error = response.warning;
            }
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to request enrollment";
          }
          render();
        });
      }

      const tabModules = document.querySelector<HTMLButtonElement>("[data-action='tab-modules']");
      if (tabModules) {
        tabModules.addEventListener("click", () => {
          state.activeTab = "modules";
          render();
        });
      }
      const tabQuestions = document.querySelector<HTMLButtonElement>("[data-action='tab-questions']");
      if (tabQuestions) {
        tabQuestions.addEventListener("click", () => {
          state.activeTab = "questions";
          render();
        });
      }

      document.querySelectorAll<HTMLButtonElement>("[data-action='open-pdf']").forEach((button) => {
        button.addEventListener("click", async () => {
          const objectKey = button.dataset.objectkey;
          if (!objectKey) {
            return;
          }
          try {
            const url = await getPresignedUrl(objectKey);
            window.open(url, "_blank", "noopener,noreferrer");
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to open PDF";
            render();
          }
        });
      });

      document.querySelectorAll<HTMLButtonElement>("[data-action='download-pdf']").forEach((button) => {
        button.addEventListener("click", async () => {
          const objectKey = button.dataset.objectkey;
          const title = button.dataset.title ?? "material";
          if (!objectKey) {
            return;
          }
          state.downloadStatus = "Preparing download";
          state.downloadProgress = 0;
          render();
          try {
            const url = await getPresignedUrl(objectKey);
            const filename = `${title.replace(/[<>:"/\\\\|?*]/g, "_")}.pdf`;
            const result = await window.lms.download.start({ url, filename });
            if (!result.ok) {
              throw new Error(result.error);
            }
            state.downloadId = result.downloadId;
            state.downloadStatus = "Starting...";
            render();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to start download";
            state.downloadStatus = "Failed";
            render();
          }
        });
      });

      if (!downloadUnsubscribe) {
        downloadUnsubscribe = window.lms.download.onProgress((payload) => {
          if (state.downloadId && payload.id !== state.downloadId) {
            return;
          }
          const total = payload.totalBytes;
          const received = payload.receivedBytes;
          const percent = total > 0 ? Math.round((received / total) * 100) : null;
          state.downloadProgress = percent ?? state.downloadProgress;
          state.downloadStatus = payload.status;
          render();
        });
      }

      document.querySelectorAll<HTMLButtonElement>("[data-action='approve-enrollment']").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.dataset.enrollment;
          if (!id) {
            return;
          }
          try {
            await approveEnrollment(id);
            await loadStudents();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to approve request";
            render();
          }
        });
      });

      document.querySelectorAll<HTMLButtonElement>("[data-action='reject-enrollment']").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.dataset.enrollment;
          if (!id) {
            return;
          }
          try {
            await rejectEnrollment(id);
            await loadStudents();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to reject request";
            render();
          }
        });
      });

      document.querySelectorAll<HTMLButtonElement>("[data-action='save-grade']").forEach((button) => {
        button.addEventListener("click", async () => {
          const userId = button.dataset.user;
          if (!userId) {
            return;
          }
          const input = document.querySelector<HTMLInputElement>(`[data-grade='${userId}']`);
          const sourceSelect = document.querySelector<HTMLSelectElement>(`[data-source='${userId}']`);
          const value = input?.value ?? "";
          const parsed = Number(value);
          if (Number.isNaN(parsed)) {
            state.error = "Grade must be a number";
            render();
            return;
          }
          const source = (sourceSelect?.value as GradeSource) || "MANUAL";
          try {
            await setCourseGrade(courseId, userId, parsed, source);
            await loadStudents();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to save grade";
            render();
          }
        });
      });

      const examForm = document.querySelector<HTMLFormElement>("#exam-result-form");
      if (examForm) {
        examForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(examForm);
          const studentId = String(data.get("studentId") || "");
          const scoreRaw = String(data.get("score") || "").trim();
          if (!studentId) {
            state.error = "Select a student";
            render();
            return;
          }
          const score = scoreRaw ? Number(scoreRaw) : undefined;
          if (scoreRaw && Number.isNaN(score)) {
            state.error = "Score must be a number";
            render();
            return;
          }
          try {
            await createExamResult(courseId, {
              userId: studentId,
              calculatedScore: score
            });
            await loadExamResults();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to create exam result";
            render();
          }
        });
      }

      const questionForm = document.querySelector<HTMLFormElement>("#question-create-form");
      if (questionForm) {
        questionForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(questionForm);
          const options = [0, 1, 2, 3].map((index) => String(data.get(`option-${index}`) || "").trim());
          const answer = Number(data.get("answer") || 0);
          const source = (data.get("source") as QuestionSource) || "PDF";
          const moduleId = String(data.get("moduleId") || "");

          if (options.some((option) => option.length === 0)) {
            state.error = "All options are required.";
            render();
            return;
          }
          const text = String(data.get("text") || "").trim();
          if (!text) {
            state.error = "Question text is required.";
            render();
            return;
          }
          if (answer < 0 || answer >= options.length) {
            state.error = "Answer index is out of range.";
            render();
            return;
          }

          try {
            const created = await createCourseQuestion(courseId, {
              text,
              options,
              answer,
              source,
              moduleId: moduleId || undefined
            });
            state.questionBank = [...state.questionBank, created];
            questionForm.reset();
            render();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to add question";
            render();
          }
        });
      }

      const loadRandomBtn = document.querySelector<HTMLButtonElement>("[data-action='load-random-questions']");
      if (loadRandomBtn) {
        loadRandomBtn.addEventListener("click", async () => {
          try {
            const data = await fetchRandomCourseQuestions(courseId, 10);
            state.randomQuestions = data;
            state.practiceResult = null;
            render();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to load random questions";
            render();
          }
        });
      }

      const submitPracticeBtn = document.querySelector<HTMLButtonElement>("[data-action='submit-practice']");
      if (submitPracticeBtn) {
        submitPracticeBtn.addEventListener("click", async () => {
          const answers = state.randomQuestions.map((question) => {
            const selected = document.querySelector<HTMLInputElement>(
              `input[name='question-${question.id}']:checked`
            );
            return { questionId: question.id, answer: Number(selected?.value ?? -1) };
          });

          try {
            const result = await submitCourseExam(courseId, { answers });
            state.practiceResult = { score: result.score, total: result.total };
            render();
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to submit answers";
            render();
          }
        });
      }

      document.querySelectorAll<HTMLDivElement>("[data-module]").forEach((moduleCard) => {
        moduleCard.addEventListener("dragstart", (event) => {
          const moduleId = moduleCard.getAttribute("data-module");
          if (!moduleId) {
            return;
          }
          event.dataTransfer?.setData("text/plain", moduleId);
        });
        moduleCard.addEventListener("dragover", (event) => {
          event.preventDefault();
        });
        moduleCard.addEventListener("drop", async (event) => {
          event.preventDefault();
          const sourceId = event.dataTransfer?.getData("text/plain");
          const targetId = moduleCard.getAttribute("data-module");
          if (!sourceId || !targetId || sourceId === targetId) {
            return;
          }

          const sourceIndex = state.moduleList.findIndex((module) => module.id === sourceId);
          const targetIndex = state.moduleList.findIndex((module) => module.id === targetId);
          if (sourceIndex === -1 || targetIndex === -1) {
            return;
          }

          const next = [...state.moduleList];
          const [moved] = next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, moved);
          state.moduleList = next.map((module, index) => ({ ...module, order: index + 1 }));
          render();

          try {
            await reorderModules(
              courseId,
              state.moduleList.map((module) => ({ id: module.id, order: module.order }))
            );
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to reorder modules";
            render();
            await loadCourse();
          }
        });
      });
    };

    const loadCourse = async () => {
      try {
        const data = await fetchCourse(courseId);
        if (nonce !== renderNonce) {
          return;
        }
        state.course = data;
        state.moduleList = data.modules;
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load course";
        render();
      }
    };

    const loadStudents = async () => {
      try {
        const [pending, enrolled] = await Promise.all([
          fetchCourseStudentsByStatus(courseId, "PENDING"),
          fetchCourseStudentsByStatus(courseId, "ENROLLED")
        ]);
        if (nonce !== renderNonce) {
          return;
        }
        state.pendingStudents = pending.map((student) => ({
          ...student,
          enrollmentId: (student as CourseStudent & { id?: string }).id ?? student.enrollmentId
        }));
        state.enrolledStudents = enrolled.map((student) => ({
          ...student,
          enrollmentId: (student as CourseStudent & { id?: string }).id ?? student.enrollmentId
        }));
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load students";
        render();
      }
    };

    const loadEnrollment = async () => {
      try {
        const data = await fetchEnrollmentStatus(courseId);
        if (nonce !== renderNonce) {
          return;
        }
        state.enrollmentStatus = data.status;
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load enrollment";
        render();
      }
    };

    const loadGrades = async () => {
      try {
        const data = await fetchMyGrades();
        if (nonce !== renderNonce) {
          return;
        }
        state.grades = data;
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load grades";
        render();
      }
    };

    const loadQuestions = async () => {
      try {
        const data = await fetchCourseQuestions(courseId);
        if (nonce !== renderNonce) {
          return;
        }
        state.questionBank = data;
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load questions";
        render();
      }
    };

    const loadExamResults = async () => {
      try {
        const results = await fetchExamResults(courseId);
        if (nonce !== renderNonce) {
          return;
        }
        state.examResults = results.map((result) => ({
          userName: `${result.user.firstName} ${result.user.lastName}`,
          score: result.calculatedScore ?? null
        }));
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load exam results";
        render();
      }
    };

    const loadMyExamResult = async () => {
      try {
        const result = await fetchMyExamResult(courseId);
        if (nonce !== renderNonce) {
          return;
        }
        state.myExamResult = { calculatedScore: result.calculatedScore ?? null };
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load exam result";
        render();
      }
    };

    render();
    void loadCourse();
    if (role === "ADMIN") {
      void loadStudents();
      void loadQuestions();
      void loadExamResults();
    }
    if (role === "STUDENT") {
      void loadEnrollment();
      void loadGrades();
      void loadMyExamResult();
    }
    return;
  }

  if (route.path === "/profile") {
    let state = {
      profile: null as UserProfile | null,
      error: null as string | null,
      success: null as string | null,
      saving: false,
      offline: false
    };

    const render = () => {
      setHtml(layout(renderProfile(state), role));
      bindSharedHandlers();
      const form = document.querySelector<HTMLFormElement>("#profile-form");
      if (form && state.profile) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          state.error = null;
          state.success = null;
          state.saving = true;
          render();
          try {
            const updated = await updateProfile({
              firstName: String(data.get("firstName") || ""),
              lastName: String(data.get("lastName") || ""),
              studentNumber:
                state.profile?.role === "STUDENT" ? String(data.get("studentNumber") || "") : undefined
            });
            state.profile = updated;
            state.success = "Profile updated";
          } catch (err) {
            state.error = err instanceof Error ? err.message : "Failed to update profile";
          } finally {
            state.saving = false;
            render();
          }
        });
      }
    };

    const loadProfile = async () => {
      try {
        const data = await getProfile();
        if (nonce !== renderNonce) {
          return;
        }
        window.localStorage.setItem("cache:profile", JSON.stringify(data));
        state.offline = false;
        state.profile = data;
        render();
      } catch (err) {
        const cached = window.localStorage.getItem("cache:profile");
        if (cached) {
          state.profile = JSON.parse(cached) as UserProfile;
          state.offline = true;
          state.error = null;
          render();
          return;
        }
        state.error = err instanceof Error ? err.message : "Failed to load profile";
        render();
      }
    };

    render();
    void loadProfile();
    return;
  }

  if (route.path === "/results") {
    let state = { role, grades: [] as GradeEntry[], error: null as string | null };
    const render = () => {
      setHtml(layout(renderResults(state), role));
      bindSharedHandlers();
    };
    render();
    if (role === "STUDENT") {
      try {
        const data = await fetchMyGrades();
        if (nonce !== renderNonce) {
          return;
        }
        state.grades = data;
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load grades";
        render();
      }
    }
    return;
  }

  if (route.path === "/admin") {
    let state = {
      role,
      metrics: null as {
        totalCourses: number;
        totalStudents: number;
        totalEnrolledStudents: number;
        averageGrade: number | null;
      } | null,
      error: null as string | null
    };
    const render = () => {
      setHtml(layout(renderAdminDashboard(state), role));
      bindSharedHandlers();
    };
    render();
    if (role === "ADMIN") {
      try {
        const data = await fetchAdminMetrics();
        if (nonce !== renderNonce) {
          return;
        }
        state.metrics = data;
        render();
      } catch (err) {
        state.error = err instanceof Error ? err.message : "Failed to load metrics";
        render();
      }
    }
    return;
  }

  if (route.path === "/seb") {
    let state: {
      status: SebStatus;
      error: string | null;
      role: UserRole | null;
      mediaStatus: "idle" | "granted" | "error";
      mediaError: string | null;
    } = {
      status: "loading",
      error: null,
      role,
      mediaStatus: "idle",
      mediaError: null
    };
    const render = () => {
      setHtml(layout(renderSeb(state), role));
      bindSharedHandlers();

      const testButton = document.querySelector<HTMLButtonElement>("[data-action='test-media']");
      const video = document.querySelector<HTMLVideoElement>("#media-preview");
      if (testButton && video) {
        testButton.addEventListener("click", async () => {
          state.mediaStatus = "idle";
          state.mediaError = null;
          render();
          try {
            if (activeMediaStream) {
              activeMediaStream.getTracks().forEach((track) => track.stop());
            }
            const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const preferred = pickPreferredCameraDevice(devices);
            let stream = initialStream;

            if (preferred?.deviceId) {
              try {
                const preferredStream = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: preferred.deviceId } },
                  audio: true
                });
                initialStream.getTracks().forEach((track) => track.stop());
                stream = preferredStream;
              } catch {
                stream = initialStream;
              }
            }

            activeMediaStream = stream;
            video.srcObject = stream;
            state.mediaStatus = "granted";
            state.mediaError = null;
            render();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Camera/microphone access failed.";
            state.mediaStatus = "error";
            state.mediaError = message;
            render();
          }
        });
      }
    };
    render();
    try {
      await checkSeb();
      state = { ...state, status: "ok", error: null };
    } catch (err) {
      state = {
        ...state,
        status: "blocked",
        error: err instanceof Error ? err.message : "SEB check failed"
      };
    }
    render();
    return;
  }

  setHtml(layout(`<p class="muted">Page not found.</p>`, role));
  bindSharedHandlers();
}

function bindSharedHandlers() {
  document.querySelectorAll<HTMLElement>("[data-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const href = (link as HTMLAnchorElement).getAttribute("href");
      if (href) {
        navigate(href.replace(/^#/, ""));
      }
    });
  });

  const logoutButton = document.querySelector<HTMLButtonElement>("[data-action='logout']");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await clearToken();
      navigate("/login");
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-action='toggle-language'] button").forEach((button) => {
    button.addEventListener("click", () => {
      const lang = button.getAttribute("data-lang");
      if (lang === "en" || lang === "tr") {
        setLocale(lang);
      }
    });
  });
}

window.addEventListener("hashchange", () => {
  if (activeMediaStream && getRoute().path !== "/seb") {
    activeMediaStream.getTracks().forEach((track) => track.stop());
    activeMediaStream = null;
  }
  void renderRoute();
});

window.addEventListener("lms-language-change", () => {
  void renderRoute();
});

void renderRoute();
