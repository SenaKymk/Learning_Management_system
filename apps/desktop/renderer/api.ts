const API_URL = "http://localhost:4000";

export type UserRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type Course = {
  id: string;
  title: string;
  description?: string | null;
  materialKey?: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  prerequisiteId?: string | null;
  createdAt: string;
};

export type ContentType = "TEXT" | "LINK" | "FILE" | "PDF" | "VIDEO";

export type Content = {
  id: string;
  title: string;
  type: ContentType;
  text?: string | null;
  url?: string | null;
  objectKey?: string | null;
};

export type Module = {
  id: string;
  title: string;
  order: number;
  contents: Content[];
};

export type CourseDetail = Course & {
  modules: Module[];
  prerequisite?: {
    id: string;
    title: string;
  } | null;
};

export type EnrollmentStatus = "NOT_ENROLLED" | "PENDING" | "ENROLLED" | "REJECTED";
export type EnrollmentRecordStatus = Exclude<EnrollmentStatus, "NOT_ENROLLED">;

export type GradeSource = "MANUAL" | "OMR" | "EXAM";

export type CourseStudent = {
  enrollmentId: string;
  userId: string;
  firstName: string;
  lastName: string;
  studentNumber?: string | null;
  status: Exclude<EnrollmentStatus, "NOT_ENROLLED">;
  score: number | null;
  source: GradeSource | null;
};

export type GradeEntry = {
  id: string;
  courseId: string;
  courseTitle: string;
  score: number | null;
  source: GradeSource;
};

export type ExamResult = {
  id: string | null;
  calculatedScore: number | null;
  score?: number | null;
  source?: "OMR" | "MCQ" | null;
};

export type ExamResultRecord = {
  id: string;
  userId: string;
  courseId: string;
  calculatedScore: number | null;
  score?: number | null;
  source?: "OMR" | "MCQ" | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    studentNumber?: string | null;
  };
};

export type QuestionSource = "PDF" | "MANUAL";

export type QuestionBank = {
  id: string;
  courseId: string;
  moduleId: string | null;
  text: string;
  options: string[];
  answer?: number;
  source: QuestionSource;
  createdAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  studentNumber?: string | null;
  role: UserRole;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type RegisterResponse = {
  ok: boolean;
};

type UploadResponse = {
  objectKey: string;
  bucket: string;
  mimeType: string;
  size: number;
};

type PresignResponse = {
  ok: boolean;
  url: string;
};

type EnrollmentResponse = {
  id?: string;
  status: EnrollmentStatus;
  warning?: string | null;
};

type ApiError = {
  error?: string;
};

export class ApiRequestError extends Error {
  status: number | null;
  isNetwork: boolean;

  constructor(message: string, status: number | null, isNetwork: boolean) {
    super(message);
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractRole(token: string): UserRole | null {
  const payload = decodeJwtPayload(token);
  const role = payload?.role;
  if (role === "ADMIN" || role === "INSTRUCTOR" || role === "STUDENT") {
    return role;
  }
  return null;
}

export function getToken() {
  return window.lms.auth.getToken();
}

export function clearToken() {
  return window.lms.auth.logout();
}

export function setUserRole(_role: UserRole | null) {
  return;
}

export function getUserRole(): UserRole | null {
  const stored = window.lms.auth.getRole();
  if (stored) {
    return stored;
  }
  const token = getToken();
  if (!token) {
    return null;
  }
  return extractRole(token);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true
): Promise<T> {
  if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    throw new ApiRequestError("FormData requests must use uploadFile()", null, false);
  }

  const headers: Record<string, string> = {};
  if (options.headers) {
    const incoming = new Headers(options.headers);
    incoming.forEach((value, key) => {
      headers[key] = value;
    });
  }

  const body = options.body ? (typeof options.body === "string" ? options.body : options.body) : undefined;

  const result = await window.lms.api.request({
    path,
    method: options.method,
    headers,
    body,
    withAuth
  });

  if (!result.ok) {
    const isNetwork = result.status === 0;
    throw new ApiRequestError(result.error, isNetwork ? null : result.status, isNetwork);
  }

  return result.data as T;
}

export async function login(email: string, password: string) {
  const result = await window.lms.auth.login(email, password);
  if (!result.ok) {
    const isNetwork = result.status === 0;
    throw new ApiRequestError(result.error, isNetwork ? null : result.status, isNetwork);
  }
  return result.data.user;
}

export async function registerUser(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
}) {
  return apiRequest<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(params)
    },
    false
  );
}

export async function fetchCourses() {
  return apiRequest<Course[]>("/courses");
}

export async function createCourse(
  title: string,
  description?: string,
  availability?: { availableFrom?: string; availableUntil?: string }
) {
  return apiRequest<Course>("/courses", {
    method: "POST",
    body: JSON.stringify({
      title,
      description,
      availableFrom: availability?.availableFrom ?? null,
      availableUntil: availability?.availableUntil ?? null
    })
  });
}

export async function cloneCourse(courseId: string) {
  return apiRequest<{ id: string; title: string }>(`/courses/${courseId}/clone`, {
    method: "POST"
  });
}

export async function fetchCourse(id: string) {
  return apiRequest<CourseDetail>(`/courses/${id}`);
}

export async function updateCourseMaterial(id: string, materialKey: string) {
  return apiRequest<Course>(`/courses/${id}/material`, {
    method: "PATCH",
    body: JSON.stringify({ materialKey })
  });
}

export async function uploadFile(file: File) {
  const buffer = await file.arrayBuffer();
  const result = await window.lms.api.uploadFile({
    name: file.name,
    type: file.type,
    data: buffer
  });
  if (!result.ok) {
    const isNetwork = result.status === 0;
    throw new ApiRequestError(result.error, isNetwork ? null : result.status, isNetwork);
  }
  return result.data as { ok: boolean } & UploadResponse;
}

export async function getPresignedUrl(objectKey: string) {
  const response = await apiRequest<PresignResponse>(`/files/presign/${objectKey}`);
  return response.url;
}

export async function checkSeb(token?: string) {
  const headers: Record<string, string> = {};

  if (token) {
    headers["x-seb-token"] = token;
  } else {
    headers["x-safe-exam-browser"] = "desktop";
  }

  return apiRequest<{ ok: boolean }>("/seb/check", {
    method: "POST",
    headers
  });
}

export async function fetchEnrollmentStatus(courseId: string) {
  return apiRequest<EnrollmentResponse>(`/courses/${courseId}/enroll`);
}

export async function requestEnrollment(courseId: string) {
  return apiRequest<EnrollmentResponse>(`/courses/${courseId}/enroll`, {
    method: "POST"
  });
}

export async function fetchCourseStudents(courseId: string) {
  return apiRequest<CourseStudent[]>(`/courses/${courseId}/students`);
}

export async function fetchCourseStudentsByStatus(courseId: string, status: EnrollmentRecordStatus) {
  return apiRequest<CourseStudent[]>(`/courses/${courseId}/students?status=${encodeURIComponent(status)}`);
}

export async function approveEnrollment(enrollmentId: string) {
  return apiRequest<{ id: string; status: EnrollmentStatus }>(`/enrollments/${enrollmentId}/approve`, {
    method: "PATCH"
  });
}

export async function rejectEnrollment(enrollmentId: string) {
  return apiRequest<{ id: string; status: EnrollmentStatus }>(`/enrollments/${enrollmentId}/reject`, {
    method: "PATCH"
  });
}

export async function setCourseGrade(courseId: string, userId: string, score: number, source: GradeSource) {
  return apiRequest<{ id: string; userId: string; courseId: string; score: number | null; source: GradeSource }>(
    `/courses/${courseId}/grades`,
    {
      method: "POST",
      body: JSON.stringify({ userId, score, source })
    }
  );
}

export async function fetchMyGrades() {
  return apiRequest<GradeEntry[]>("/my-grades");
}

export async function fetchExamResults(courseId: string) {
  return apiRequest<ExamResultRecord[]>(`/courses/${courseId}/exam-results`);
}

export async function fetchMyExamResult(courseId: string) {
  return apiRequest<ExamResult>(`/courses/${courseId}/exam-results/me`);
}

export async function createExamResult(courseId: string, payload: {
  userId: string;
  calculatedScore?: number;
  rawData?: unknown;
}) {
  return apiRequest<{ id: string; userId: string; courseId: string; calculatedScore: number | null }>(
    `/courses/${courseId}/exam-results`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function getProfile() {
  return apiRequest<UserProfile>("/me");
}

export async function updateProfile(payload: {
  firstName: string;
  lastName: string;
  studentNumber?: string;
}) {
  return apiRequest<UserProfile>("/me", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function fetchCourseModules(courseId: string) {
  return apiRequest<Module[]>(`/courses/${courseId}/modules`);
}

export async function reorderModules(courseId: string, modules: Array<{ id: string; order: number }>) {
  return apiRequest<{ ok: boolean }>("/modules/reorder", {
    method: "PATCH",
    body: JSON.stringify({ courseId, modules })
  });
}

export async function fetchCourseQuestions(courseId: string) {
  return apiRequest<QuestionBank[]>(`/courses/${courseId}/questions`);
}

export async function fetchRandomCourseQuestions(courseId: string, limit = 10) {
  return apiRequest<QuestionBank[]>(`/courses/${courseId}/questions/random?limit=${limit}`);
}

export async function createCourseQuestion(courseId: string, payload: {
  text: string;
  options: string[];
  answer: number;
  source: QuestionSource;
  moduleId?: string;
}) {
  return apiRequest<QuestionBank>(`/courses/${courseId}/questions`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function submitCourseExam(courseId: string, payload: {
  answers: Array<{ questionId: string; answer: number }>;
}) {
  return apiRequest<{ id: string; score: number; total: number }>(
    `/courses/${courseId}/exams/submit`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function fetchAdminMetrics() {
  return apiRequest<{
    totalCourses: number;
    totalStudents: number;
    totalEnrolledStudents: number;
    averageGrade: number | null;
  }>("/admin/metrics");
}

export function getApiUrl() {
  return API_URL;
}
