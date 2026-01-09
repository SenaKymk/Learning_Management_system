import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { ApiRequestError } from "./errors";
import {
  type AdminMetrics,
  type AuthUser,
  type Content,
  type Course,
  type CourseDetail,
  type CourseStudent,
  type ExamResult,
  type ExamResultRecord,
  type GradeEntry,
  type GradeSource,
  type OmrAnswerKeyResult,
  type OmrExportEntry,
  type OmrGradeResult,
  type QuestionBank,
  type QuestionSource,
  type UserProfile,
  type UserRole
} from "./types";

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

type EnrollmentStatus = "NOT_ENROLLED" | "PENDING" | "ENROLLED" | "REJECTED";
type EnrollmentResponse = {
  id?: string;
  status: EnrollmentStatus;
  warning?: string | null;
};

type ApiError = {
  error?: string;
};

const TOKEN_KEY = "lms_token";
const ROLE_KEY = "lms_role";
const CACHE_PREFIX = "lms_cache";
const rawBaseUrl =
  (Constants?.expoConfig as { extra?: { apiUrl?: string } } | undefined)?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:4000";

const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const isAndroidEmulator = Platform.OS === "android" && Constants.isDevice === false;
const BASE_URL =
  isAndroidEmulator && /localhost|127\.0\.0\.1/.test(normalizedBaseUrl)
    ? normalizedBaseUrl.replace(/localhost|127\.0\.0\.1/, "10.0.2.2")
    : normalizedBaseUrl;

let inMemoryToken: string | null = null;
let inMemoryRole: UserRole | null = null;
const cacheMeta = new Map<string, { hit: boolean; ts: number | null }>();

type CacheEntry<T> = {
  ts: number;
  data: T;
};

function cacheKey(key: string) {
  return `${CACHE_PREFIX}:${key}`;
}

function setCacheMeta(key: string, hit: boolean, ts: number | null) {
  cacheMeta.set(key, { hit, ts });
}

export function getCacheMeta(key: string) {
  return cacheMeta.get(key) ?? { hit: false, ts: null };
}

async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const raw = await AsyncStorage.getItem(cacheKey(key));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { ts: Date.now(), data };
  await AsyncStorage.setItem(cacheKey(key), JSON.stringify(entry));
}

async function cachedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    await writeCache(key, data);
    setCacheMeta(key, false, Date.now());
    return data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.isNetwork) {
      const cached = await readCache<T>(key);
      if (cached) {
        setCacheMeta(key, true, cached.ts);
        return cached.data;
      }
    }
    setCacheMeta(key, false, null);
    throw err;
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
    if (typeof globalThis.atob !== "function") {
      return null;
    }
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
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

export async function getToken() {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  const stored = await AsyncStorage.getItem(TOKEN_KEY);
  inMemoryToken = stored;
  return stored;
}

export async function setToken(token: string) {
  inMemoryToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  inMemoryToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function setUserRole(role: UserRole | null) {
  inMemoryRole = role;
  if (!role) {
    await AsyncStorage.removeItem(ROLE_KEY);
    return;
  }
  await AsyncStorage.setItem(ROLE_KEY, role);
}

export async function getUserRole() {
  if (inMemoryRole) {
    return inMemoryRole;
  }
  const stored = await AsyncStorage.getItem(ROLE_KEY);
  if (stored === "ADMIN" || stored === "INSTRUCTOR" || stored === "STUDENT") {
    inMemoryRole = stored;
    return stored;
  }

  const token = await getToken();
  if (!token) {
    return null;
  }
  const role = extractRole(token);
  if (role) {
    await setUserRole(role);
  }
  return role;
}

async function apiRequest<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const headers = new Headers(options.headers);

  if (withAuth) {
    const token = await getToken();
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
    response = await fetch(`${BASE_URL}${path}`, {
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

  await setToken(response.token);
  const role = extractRole(response.token) ?? response.user.role;
  await setUserRole(role);
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
  return cachedRequest("courses", () => apiRequest<Course[]>("/courses"));
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
  return cachedRequest(`course_${id}`, () => apiRequest<CourseDetail>(`/courses/${id}`));
}

export async function updateCourseMaterial(id: string, materialKey: string) {
  return apiRequest<Course>(`/courses/${id}/material`, {
    method: "PATCH",
    body: JSON.stringify({ materialKey })
  });
}

export type UploadableFile = {
  uri: string;
  name: string;
  type?: string | null;
};

export async function uploadFile(file: UploadableFile) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type ?? "application/octet-stream"
  } as unknown as Blob);

  return apiRequest<{ ok: boolean } & UploadResponse>("/files/upload", {
    method: "POST",
    body: formData
  });
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
  return apiRequest<{ ok: boolean }>("/seb/check", { method: "GET", headers });
}

export async function fetchEnrollmentStatus(courseId: string) {
  return apiRequest<EnrollmentResponse>(`/courses/${courseId}/enroll`);
}

export async function requestEnrollment(courseId: string) {
  return apiRequest<EnrollmentResponse>(`/courses/${courseId}/enroll`, {
    method: "POST"
  });
}

export async function fetchCourseStudents(courseId: string, status?: EnrollmentResponse["status"]) {
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
  return apiRequest<CourseDetail["modules"]>(`/courses/${courseId}/modules`);
}

export async function reorderModules(
  courseId: string,
  modules: Array<{ id: string; order: number }>
) {
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

export async function processOmrAnswerKey(courseId: string, objectKey: string) {
  return apiRequest<OmrAnswerKeyResult>("/omr/answer-key", {
    method: "POST",
    body: JSON.stringify({ courseId, objectKey })
  });
}

export async function processOmrGrade(courseId: string, objectKey: string) {
  return apiRequest<OmrGradeResult>("/omr/grade", {
    method: "POST",
    body: JSON.stringify({ courseId, objectKey })
  });
}

export async function processOmrSampleAnswerKey(courseId: string) {
  return apiRequest<OmrAnswerKeyResult>("/omr/sample/answer-key", {
    method: "POST",
    body: JSON.stringify({ courseId })
  });
}

export async function processOmrSampleGrade(courseId: string) {
  return apiRequest<OmrGradeResult>("/omr/sample/grade", {
    method: "POST",
    body: JSON.stringify({ courseId })
  });
}

export async function exportOmrResults(courseId: string) {
  return apiRequest<{ ok: true; results: OmrExportEntry[] }>("/omr/export", {
    method: "POST",
    body: JSON.stringify({ courseId })
  });
}

export type EnrollmentStatusValue = EnrollmentStatus;
export type ContentEntity = Content;
