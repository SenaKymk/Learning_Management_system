// Configure in apps/web/.env.local: NEXT_PUBLIC_API_URL=http://localhost:4000
const resolvedApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim() || "http://localhost:4000";
const API_URL = resolvedApiUrl.replace(/\/+$/, "");

let apiUrlLogged = false;
if (typeof window !== "undefined" && !apiUrlLogged) {
  apiUrlLogged = true;
  console.info(`API_URL: ${API_URL}`);
}

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

export type GradeSource = "MANUAL" | "OMR" | "EXAM";

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
};

export type ExamResultRecord = {
  id: string;
  userId: string;
  courseId: string;
  calculatedScore: number | null;
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

export type AdminMetrics = {
  totalCourses: number;
  totalStudents: number;
  totalEnrolledStudents: number;
  averageGrade: number | null;
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

function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem("token");
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
  return getStoredToken();
}

export function setToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem("token", token);
}

export function clearToken() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem("token");
}

export function setUserRole(role: UserRole | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (!role) {
    window.localStorage.removeItem("role");
    return;
  }
  window.localStorage.setItem("role", role);
}

export function getUserRole(): UserRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem("role");
  if (stored === "ADMIN" || stored === "INSTRUCTOR" || stored === "STUDENT") {
    return stored;
  }

  const token = getStoredToken();
  if (!token) {
    return null;
  }

  const role = extractRole(token);
  if (role) {
    setUserRole(role);
  }
  return role;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true
): Promise<T> {
  const headers = new Headers(options.headers);

  if (withAuth) {
    // Attach bearer token when available.
    const token = getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new ApiRequestError("Backend unreachable", null, true);
  }

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = (await response.json()) as ApiError;
      message = data.error ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiRequestError(message, response.status, false);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string) {
  const response = await apiRequest<LoginResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password })
    },
    false
  );

  setToken(response.token);
  const role = extractRole(response.token) ?? response.user.role;
  setUserRole(role);
  return response.user;
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

export async function createCourse(title: string, description?: string) {
  return apiRequest<Course>("/courses", {
    method: "POST",
    body: JSON.stringify({ title, description })
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
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiRequest<{ ok: boolean } & UploadResponse>(
    "/files/upload",
    {
      method: "POST",
      body: formData
    }
  );

  return response;
}

export async function getPresignedUrl(objectKey: string) {
  const response = await apiRequest<PresignResponse>(`/files/presign/${objectKey}`);
  return response.url;
}

export async function checkSeb(requestHash?: string) {
  const headers: Record<string, string> = {};

  if (requestHash !== undefined) {
    headers["X-SafeExamBrowser-RequestHash"] = requestHash;
  }

  return apiRequest<{ ok: boolean }>("/seb/check", {
    method: "GET",
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

export async function fetchCourseStudents(courseId: string, status?: EnrollmentRecordStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<CourseStudent[]>(`/courses/${courseId}/students${query}`);
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

export async function setCourseGrade(
  courseId: string,
  userId: string,
  score: number,
  source: GradeSource
) {
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

export async function fetchAdminMetrics() {
  return apiRequest<AdminMetrics>("/admin/metrics");
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
