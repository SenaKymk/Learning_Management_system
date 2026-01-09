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

export type GradeSource = "MANUAL" | "OMR" | "EXAM";

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

export type OmrAnswerKeyResult = {
  ok: true;
  answers: string[];
  total: number;
  warnings: string[];
  debugImage?: string;
};

export type OmrGradeResult = {
  ok: true;
  studentNumber: string;
  answers: string[];
  correct: number;
  total: number;
  score: number;
  userId: string | null;
  warnings: string[];
  debugImage?: string;
};

export type OmrExportEntry = {
  id: string;
  userId: string;
  courseId: string;
  studentNumber: string | null;
  name: string;
  calculatedScore: number | null;
  rawData: unknown;
};
