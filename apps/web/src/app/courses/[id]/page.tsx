"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGuard from "../../../components/AuthGuard";
import FileUpload from "../../../components/FileUpload";
import {
  createExamResult,
  fetchCourse,
  fetchCourseQuestions,
  fetchRandomCourseQuestions,
  fetchCourseStudents,
  fetchEnrollmentStatus,
  fetchExamResults,
  fetchMyExamResult,
  fetchMyGrades,
  getPresignedUrl,
  getUserRole,
  createCourseQuestion,
  requestEnrollment,
  setCourseGrade,
  approveEnrollment,
  rejectEnrollment,
  updateCourseMaterial,
  reorderModules,
  submitCourseExam,
  type CourseStudent,
  type CourseDetail,
  type Content,
  type ExamResult,
  type ExamResultRecord,
  type GradeEntry,
  type GradeSource,
  type EnrollmentStatus,
  type QuestionBank,
  type QuestionSource,
  type UserRole
} from "../../../modules/api";
import { useI18n } from "../../../modules/i18n";

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [opening, setOpening] = useState(false);
  const [activeTab, setActiveTab] = useState<"modules" | "questions">("modules");
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus>("NOT_ENROLLED");
  const [pendingStudents, setPendingStudents] = useState<CourseStudent[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<CourseStudent[]>([]);
  const [moduleList, setModuleList] = useState<CourseDetail["modules"]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [gradeSources, setGradeSources] = useState<Record<string, GradeSource>>({});
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [contentOpening, setContentOpening] = useState<Record<string, boolean>>({});
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [examResults, setExamResults] = useState<ExamResultRecord[]>([]);
  const [examStudentId, setExamStudentId] = useState("");
  const [examScoreInput, setExamScoreInput] = useState("");
  const [examSaving, setExamSaving] = useState(false);
  const [myExamResult, setMyExamResult] = useState<ExamResult | null>(null);
  const [questions, setQuestions] = useState<QuestionBank[]>([]);
  const [randomQuestions, setRandomQuestions] = useState<QuestionBank[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [questionOptions, setQuestionOptions] = useState(["", "", "", ""]);
  const [questionAnswer, setQuestionAnswer] = useState("0");
  const [questionSource, setQuestionSource] = useState<QuestionSource>("PDF");
  const [questionModuleId, setQuestionModuleId] = useState("");
  const [questionSaving, setQuestionSaving] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [practiceResult, setPracticeResult] = useState<{ score: number; total: number } | null>(
    null
  );
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const { t } = useI18n();

  const syncEnrolledStudents = (data: CourseStudent[]) => {
    setEnrolledStudents(data);
    const nextInputs: Record<string, string> = {};
    const nextSources: Record<string, GradeSource> = {};
    data.forEach((student) => {
      if (student.score !== null && student.score !== undefined) {
        nextInputs[student.userId] = String(student.score);
      }
      nextSources[student.userId] = student.source ?? "MANUAL";
    });
    setGradeInputs(nextInputs);
    setGradeSources(nextSources);
  };

  const refreshEnrollmentLists = async () => {
    if (!courseId) {
      return;
    }

    const [pending, enrolled] = await Promise.all([
      fetchCourseStudents(courseId, "PENDING"),
      fetchCourseStudents(courseId, "ENROLLED")
    ]);
    setPendingStudents(pending);
    syncEnrolledStudents(enrolled);
  };

  useEffect(() => {
    if (!courseId) {
      return;
    }

    const load = async () => {
      try {
        const data = await fetchCourse(courseId);
        setCourse(data);
        setModuleList(data.modules);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load course";
        setError(message);
      }
    };

    load();
  }, [courseId]);

  useEffect(() => {
    const currentRole = getUserRole();
    setRole(currentRole);

    if (!courseId) {
      return;
    }

    if (currentRole === "ADMIN") {
      refreshEnrollmentLists().catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to load students";
        setError(message);
      });

      fetchCourseQuestions(courseId)
        .then((data) => setQuestions(data))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load questions";
          setError(message);
        });

      fetchExamResults(courseId)
        .then((data) => setExamResults(data))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load exam results";
          setError(message);
        });
    }

    if (currentRole === "STUDENT") {
      fetchEnrollmentStatus(courseId)
        .then((data) => setEnrollmentStatus(data.status))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load enrollment";
          setError(message);
        });

      fetchMyGrades()
        .then((data) => setGrades(data))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load grades";
          setError(message);
        });

      fetchMyExamResult(courseId)
        .then((data) => setMyExamResult(data))
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Failed to load exam result";
          setError(message);
        });
    }
  }, [courseId]);

  const handleMaterialUpload = async (objectKey: string) => {
    if (!courseId) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCourseMaterial(courseId, objectKey);
      setCourse((prev) => (prev ? { ...prev, materialKey: updated.materialKey } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update material";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleViewMaterial = async () => {
    if (!course?.materialKey) {
      return;
    }

    setOpening(true);
    setError(null);
    try {
      const url = await getPresignedUrl(course.materialKey);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open material";
      setError(message);
    } finally {
      setOpening(false);
    }
  };

  const handleOpenContentPdf = async (contentId: string, objectKey?: string | null) => {
    if (!objectKey) {
      return;
    }

    setContentOpening((prev) => ({ ...prev, [contentId]: true }));
    setError(null);
    try {
      const url = await getPresignedUrl(objectKey);
      setPdfUrls((prev) => ({ ...prev, [contentId]: url }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open PDF";
      setError(message);
    } finally {
      setContentOpening((prev) => ({ ...prev, [contentId]: false }));
    }
  };

  const handleRequestEnrollment = async () => {
    if (!courseId) {
      return;
    }

    setError(null);
    try {
      const response = await requestEnrollment(courseId);
      setEnrollmentStatus(response.status);
      if (response.warning) {
        setError(response.warning);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to request enrollment";
      setError(message);
    }
  };

  const handleApprove = async (enrollmentId: string) => {
    try {
      await approveEnrollment(enrollmentId);
      await refreshEnrollmentLists();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to approve request";
      setError(message);
    }
  };

  const handleReject = async (enrollmentId: string) => {
    try {
      await rejectEnrollment(enrollmentId);
      await refreshEnrollmentLists();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reject request";
      setError(message);
    }
  };

  const handleGradeChange = (userId: string, value: string) => {
    setGradeInputs((prev) => ({ ...prev, [userId]: value }));
  };

  const handleSourceChange = (userId: string, value: GradeSource) => {
    setGradeSources((prev) => ({ ...prev, [userId]: value }));
  };

  const handleSaveGrade = async (userId: string) => {
    if (!courseId) {
      return;
    }

    const value = gradeInputs[userId];
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setError("Grade must be a number");
      return;
    }

    try {
      const source = gradeSources[userId] ?? "MANUAL";
      await setCourseGrade(courseId, userId, parsed, source);
      await refreshEnrollmentLists();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save grade";
      setError(message);
    }
  };

  const handleQuestionOptionChange = (index: number, value: string) => {
    setQuestionOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleCreateQuestion = async () => {
    if (!courseId) {
      return;
    }

    const answerIndex = Number(questionAnswer);
    if (Number.isNaN(answerIndex)) {
      setError("Answer index must be a number");
      return;
    }

    setQuestionSaving(true);
    setError(null);
    try {
      const normalizedOptions = questionOptions.map((option) => option.trim());
      const payload = {
        text: questionText.trim(),
        options: normalizedOptions,
        answer: answerIndex,
        source: questionSource,
        moduleId: questionModuleId || undefined
      };
      if (!payload.text) {
        setError("Question text is required");
        return;
      }
      if (payload.options.some((option) => option.length === 0)) {
        setError("All options are required");
        return;
      }
      if (payload.options.length < 2 || answerIndex >= payload.options.length) {
        setError("Answer index is out of range");
        return;
      }
      const created = await createCourseQuestion(courseId, payload);
      setQuestions((prev) => [...prev, created]);
      setQuestionText("");
      setQuestionOptions(["", "", "", ""]);
      setQuestionAnswer("0");
      setQuestionModuleId("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add question";
      setError(message);
    } finally {
      setQuestionSaving(false);
    }
  };

  const handleLoadRandomQuestions = async () => {
    if (!courseId) {
      return;
    }

    setError(null);
    try {
      const data = await fetchRandomCourseQuestions(courseId, 10);
      setRandomQuestions(data);
      setPracticeAnswers({});
      setPracticeResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load random questions";
      setError(message);
    }
  };

  const handlePracticeAnswerChange = (questionId: string, value: number) => {
    setPracticeAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitPractice = async () => {
    if (!courseId) {
      return;
    }

    const answers = randomQuestions.map((question) => ({
      questionId: question.id,
      answer: practiceAnswers[question.id] ?? -1
    }));

    setError(null);
    try {
      const result = await submitCourseExam(courseId, { answers });
      setPracticeResult({ score: result.score, total: result.total });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit answers";
      setError(message);
    }
  };

  const handleDragStart = (moduleId: string) => (event: React.DragEvent<HTMLDivElement>) => {
    setDraggingModuleId(moduleId);
    event.dataTransfer.setData("text/plain", moduleId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (targetId: string) => async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      return;
    }

    const sourceIndex = moduleList.findIndex((module) => module.id === sourceId);
    const targetIndex = moduleList.findIndex((module) => module.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const next = [...moduleList];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    const updated = next.map((module, index) => ({
      ...module,
      order: index + 1
    }));

    const previous = moduleList;
    setModuleList(updated);
    setDraggingModuleId(null);

    try {
      if (courseId) {
        await reorderModules(
          courseId,
          updated.map((module) => ({ id: module.id, order: module.order }))
        );
      }
    } catch (err) {
      setModuleList(previous);
      const message = err instanceof Error ? err.message : "Failed to reorder modules";
      setError(message);
    }
  };

  const handleCreateExamResult = async () => {
    if (!courseId || !examStudentId) {
      return;
    }

    const parsedScore =
      examScoreInput.trim() === "" ? undefined : Number(examScoreInput.trim());
    if (parsedScore !== undefined && Number.isNaN(parsedScore)) {
      setError("Exam score must be a number");
      return;
    }

    setExamSaving(true);
    setError(null);
    try {
      await createExamResult(courseId, {
        userId: examStudentId,
        calculatedScore: parsedScore
      });
      const data = await fetchExamResults(courseId);
      setExamResults(data);
      setExamScoreInput("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create exam result";
      setError(message);
    } finally {
      setExamSaving(false);
    }
  };

  const getVideoEmbedUrl = (url?: string | null) => {
    if (!url) {
      return null;
    }

    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
    if (youtubeMatch?.[1]) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return null;
  };

  const renderContent = (content: Content) => {
    if (content.type === "TEXT") {
      return <p className="text-sm text-slate-300">{content.text}</p>;
    }

    if (content.type === "LINK") {
      return (
        <a className="text-sm text-primary-200 hover:underline" href={content.url ?? "#"}>
          {content.url}
        </a>
      );
    }

    if (content.type === "VIDEO") {
      const embedUrl = getVideoEmbedUrl(content.url);
      if (!embedUrl) {
        return (
          <a className="text-sm text-primary-200 hover:underline" href={content.url ?? "#"}>
            {content.url}
          </a>
        );
      }

      return (
        <div className="aspect-video overflow-hidden rounded-lg border border-white/10">
          <iframe
            className="h-full w-full"
            src={embedUrl}
            title={content.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    if (content.type === "PDF") {
      const openingContent = contentOpening[content.id];
      const pdfUrl = pdfUrls[content.id];
      return (
        <div className="grid gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleOpenContentPdf(content.id, content.objectKey)}
            disabled={openingContent}
          >
            {openingContent ? "Loading..." : pdfUrl ? "Reload PDF" : "View PDF"}
          </button>
          {pdfUrl ? (
            <iframe
              className="h-80 w-full rounded-lg border border-white/10"
              src={pdfUrl}
              title={content.title}
            />
          ) : null}
        </div>
      );
    }

    return <p className="text-sm text-slate-300">File: {content.objectKey}</p>;
  };

  const availability = (() => {
    if (!course) {
      return null;
    }
    const now = new Date();
    const availableFrom = course.availableFrom ? new Date(course.availableFrom) : null;
    const availableUntil = course.availableUntil ? new Date(course.availableUntil) : null;

    if (availableFrom && now < availableFrom) {
      return { label: "Not yet available", state: "PENDING", isAvailable: false };
    }
    if (availableUntil && now > availableUntil) {
      return { label: "Expired", state: "EXPIRED", isAvailable: false };
    }
    return { label: "Available", state: "ACTIVE", isAvailable: true };
  })();

  const moduleTitleMap = new Map(moduleList.map((module) => [module.id, module.title]));

  return (
    <AuthGuard>
      <div className="grid gap-6">
        {error ? <p className="text-rose-300">{error}</p> : null}
        {!course ? <p className="text-slate-400">Loading...</p> : null}
        {course ? (
          <div className="grid gap-6">
            <div className="card p-6">
              <h1 className="text-3xl font-semibold text-white">{course.title}</h1>
              <p className="mt-2 text-slate-300">
                {course.description ?? "No description available"}
              </p>
              {course.prerequisite ? (
                <p className="mt-2 text-sm text-amber-300">
                  Prerequisite: {course.prerequisite.title}. Enrollment is allowed, but completion is recommended.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="badge">
                  {course.materialKey ? "Material linked" : "Material missing"}
                </span>
                {availability ? (
                  <span className="badge">{availability.label}</span>
                ) : null}
                {role === "ADMIN" ? (
                  <FileUpload accept="application/pdf" onUploaded={handleMaterialUpload} />
                ) : null}
                {role === "STUDENT" && course.materialKey ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleViewMaterial}
                    disabled={opening}
                  >
                    {opening ? "Opening..." : "View Material"}
                  </button>
                ) : null}
                {saving ? <span className="text-xs text-slate-400">Updating...</span> : null}
              </div>
            </div>
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-white">Students</h2>
              <p className="mt-1 text-sm text-slate-300">
                Enrollment management and status. Some exams may require Safe Exam Browser.
              </p>
              {role === "ADMIN" ? (
                <div className="mt-4 grid gap-6">
                  <div className="grid gap-3">
                    <h3 className="text-lg font-semibold text-white">Pending requests</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-slate-200">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingStudents.length === 0 ? (
                            <tr className="border-t border-white/10">
                              <td className="px-4 py-3 text-slate-400" colSpan={2}>
                                No pending requests.
                              </td>
                            </tr>
                          ) : null}
                          {pendingStudents.map((student) => (
                            <tr key={student.id} className="border-t border-white/10">
                              <td className="px-4 py-3">
                                {student.firstName} {student.lastName}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleApprove(student.id)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleReject(student.id)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <h3 className="text-lg font-semibold text-white">Enrolled students</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-slate-200">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrolledStudents.length === 0 ? (
                            <tr className="border-t border-white/10">
                              <td className="px-4 py-3 text-slate-400" colSpan={3}>
                                No enrolled students yet.
                              </td>
                            </tr>
                          ) : null}
                          {enrolledStudents.map((student) => (
                            <tr key={student.id} className="border-t border-white/10">
                              <td className="px-4 py-3">
                                {student.firstName} {student.lastName}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={gradeInputs[student.userId] ?? ""}
                                    onChange={(event) =>
                                      handleGradeChange(student.userId, event.target.value)
                                    }
                                    className="w-20 rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-white"
                                    placeholder="-"
                                    min={0}
                                    max={100}
                                  />
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleSaveGrade(student.userId)}
                                  >
                                    Save
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={gradeSources[student.userId] ?? "MANUAL"}
                                  onChange={(event) =>
                                    handleSourceChange(student.userId, event.target.value as GradeSource)
                                  }
                                  className="rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-white"
                                >
                                  <option value="MANUAL">Manual</option>
                                  <option value="OMR">OMR</option>
                                  <option value="EXAM">Exam</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  {enrollmentStatus === "ENROLLED" ? (
                    <p className="text-sm text-emerald-300">You are enrolled in this course.</p>
                  ) : enrollmentStatus === "PENDING" ? (
                    <p className="text-sm text-amber-300">Enrollment request pending.</p>
                  ) : enrollmentStatus === "REJECTED" ? (
                    <p className="text-sm text-rose-300">Enrollment request rejected.</p>
                  ) : availability && !availability.isAvailable ? (
                    <p className="text-sm text-amber-300">Course is {availability.label.toLowerCase()}.</p>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleRequestEnrollment}
                    >
                      Request to join this course
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="card p-6">
              <h2 className="text-xl font-semibold text-white">Results</h2>
              <p className="mt-1 text-sm text-slate-300">
                OMR-ready results view. Some exams may require Safe Exam Browser.
              </p>
              {role === "ADMIN" ? (
                <div className="mt-4 grid gap-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-200">
                      <thead className="bg-white/5 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrolledStudents.length === 0 ? (
                          <tr className="border-t border-white/10">
                            <td className="px-4 py-3 text-slate-400" colSpan={3}>
                              No grades available.
                            </td>
                          </tr>
                        ) : null}
                        {enrolledStudents.map((row) => (
                          <tr key={row.id} className="border-t border-white/10">
                            <td className="px-4 py-3">
                              {row.firstName} {row.lastName}
                            </td>
                            <td className="px-4 py-3">{row.source ?? "-"}</td>
                            <td className="px-4 py-3">{row.score ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid gap-3">
                    <h3 className="text-lg font-semibold text-white">Exam Results (OMR)</h3>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="grid gap-1 text-sm text-slate-300">
                        Student
                        <select
                          value={examStudentId}
                          onChange={(event) => setExamStudentId(event.target.value)}
                          className="min-w-[220px] rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-white"
                        >
                          <option value="">Select student</option>
                          {enrolledStudents.map((student) => (
                            <option key={student.userId} value={student.userId}>
                              {student.firstName} {student.lastName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm text-slate-300">
                        Calculated score
                        <input
                          type="number"
                          value={examScoreInput}
                          onChange={(event) => setExamScoreInput(event.target.value)}
                          className="w-32 rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-white"
                          placeholder="-"
                          min={0}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleCreateExamResult}
                        disabled={examSaving || !examStudentId}
                      >
                        {examSaving ? "Saving..." : "Create result"}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-slate-200">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Calculated score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {examResults.length === 0 ? (
                            <tr className="border-t border-white/10">
                              <td className="px-4 py-3 text-slate-400" colSpan={2}>
                                No exam results recorded.
                              </td>
                            </tr>
                          ) : null}
                          {examResults.map((result) => (
                            <tr key={result.id} className="border-t border-white/10">
                              <td className="px-4 py-3">
                                {result.user.firstName} {result.user.lastName}
                              </td>
                              <td className="px-4 py-3">{result.calculatedScore ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {grades.length === 0 ? (
                    <p className="text-sm text-slate-400">No grades available yet.</p>
                  ) : null}
                  {grades
                    .filter((grade) => grade.courseId === course.id)
                    .map((result) => (
                      <div key={result.id} className="rounded-xl border border-white/10 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">{result.courseTitle}</p>
                            <p className="text-base font-semibold text-white">Course Grade</p>
                            <p className="text-xs text-slate-400">Source: {result.source}</p>
                          </div>
                          <span className="badge">{result.score ?? "Not graded yet"}</span>
                        </div>
                      </div>
                    ))}
                  <div className="rounded-xl border border-white/10 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">OMR / Exam result</p>
                        <p className="text-base font-semibold text-white">Calculated score</p>
                      </div>
                      <span className="badge">
                        {myExamResult?.calculatedScore ?? "Not graded yet"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={activeTab === "modules" ? "btn" : "btn-secondary"}
                onClick={() => setActiveTab("modules")}
              >
                {t("modules")}
              </button>
              <button
                type="button"
                className={activeTab === "questions" ? "btn" : "btn-secondary"}
                onClick={() => setActiveTab("questions")}
              >
                {t("questions")}
              </button>
            </div>
            {activeTab === "modules" ? (
              <div className="grid gap-4">
                {moduleList.length === 0 ? (
                  <p className="text-slate-400">No modules yet.</p>
                ) : (
                  moduleList.map((module) => (
                    <div key={module.id} className="card p-5">
                      <div
                        className="flex items-center justify-between"
                        draggable={role === "ADMIN"}
                        onDragStart={handleDragStart(module.id)}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop(module.id)}
                      >
                        <div className="flex items-center gap-3">
                          <h2 className="text-lg font-semibold text-white">{module.title}</h2>
                          {role === "ADMIN" ? (
                            <span className="text-xs text-slate-400">
                              {draggingModuleId === module.id ? "Dragging..." : "Drag to reorder"}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-slate-400">Order {module.order}</span>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-2">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                            PDF Materials
                          </h3>
                          {module.contents.filter((content) => content.type === "PDF").length === 0 ? (
                            <p className="text-sm text-slate-400">No PDF materials yet.</p>
                          ) : (
                            module.contents
                              .filter((content) => content.type === "PDF")
                              .map((content) => (
                                <div key={content.id} className="rounded-xl border border-white/10 p-3">
                                  <p className="text-sm font-semibold text-white">{content.title}</p>
                                  {renderContent(content)}
                                </div>
                              ))
                          )}
                        </div>
                        <div className="grid gap-2">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Other Content
                          </h3>
                          {module.contents.filter((content) => content.type !== "PDF").length === 0 ? (
                            <p className="text-sm text-slate-400">No additional content yet.</p>
                          ) : (
                            module.contents
                              .filter((content) => content.type !== "PDF")
                              .map((content) => (
                                <div key={content.id} className="rounded-xl border border-white/10 p-3">
                                  <p className="text-sm font-semibold text-white">{content.title}</p>
                                  {renderContent(content)}
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="grid gap-6">
                {role === "ADMIN" ? (
                  <div className="card p-5">
                    <h2 className="text-lg font-semibold text-white">Add question</h2>
                    <div className="mt-4 grid gap-4">
                      <label className="grid gap-2 text-sm text-slate-200">
                        Question text
                        <textarea
                          value={questionText}
                          onChange={(event) => setQuestionText(event.target.value)}
                          className="min-h-[120px] rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                        />
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {questionOptions.map((option, index) => (
                          <label key={index} className="grid gap-2 text-sm text-slate-200">
                            Option {index + 1}
                            <input
                              type="text"
                              value={option}
                              onChange={(event) => handleQuestionOptionChange(index, event.target.value)}
                              className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="grid gap-2 text-sm text-slate-200">
                          Correct answer index
                          <input
                            type="number"
                            min={0}
                            max={questionOptions.length - 1}
                            value={questionAnswer}
                            onChange={(event) => setQuestionAnswer(event.target.value)}
                            className="w-32 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                          />
                        </label>
                        <label className="grid gap-2 text-sm text-slate-200">
                          Source
                          <select
                            value={questionSource}
                            onChange={(event) => setQuestionSource(event.target.value as QuestionSource)}
                            className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                          >
                            <option value="PDF">PDF</option>
                            <option value="MANUAL">Manual</option>
                          </select>
                        </label>
                        <label className="grid gap-2 text-sm text-slate-200">
                          Module (optional)
                          <select
                            value={questionModuleId}
                            onChange={(event) => setQuestionModuleId(event.target.value)}
                            className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-white"
                          >
                            <option value="">No module</option>
                            {moduleList.map((module) => (
                              <option key={module.id} value={module.id}>
                                {module.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button
                        type="button"
                        className="btn w-fit"
                        onClick={handleCreateQuestion}
                        disabled={questionSaving}
                      >
                        {questionSaving ? "Saving..." : "Add question"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Practice questions</h2>
                        <p className="text-sm text-slate-300">
                          Pull a random set and submit for automatic grading.
                        </p>
                      </div>
                      <button type="button" className="btn" onClick={handleLoadRandomQuestions}>
                        Load random questions
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4">
                      {randomQuestions.length === 0 ? (
                        <p className="text-sm text-slate-400">No questions loaded yet.</p>
                      ) : (
                        randomQuestions.map((question, index) => (
                          <div key={question.id} className="rounded-xl border border-white/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-slate-400">Question {index + 1}</p>
                                <p className="text-base font-semibold text-white">{question.text}</p>
                                <p className="text-xs text-slate-400">Source: {question.source}</p>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2">
                              {question.options.map((option, optionIndex) => (
                                <label
                                  key={`${question.id}-${optionIndex}`}
                                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200"
                                >
                                  <input
                                    type="radio"
                                    name={`question-${question.id}`}
                                    value={optionIndex}
                                    checked={practiceAnswers[question.id] === optionIndex}
                                    onChange={() => handlePracticeAnswerChange(question.id, optionIndex)}
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {randomQuestions.length > 0 ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button type="button" className="btn" onClick={handleSubmitPractice}>
                          {t("submit")}
                        </button>
                        {practiceResult ? (
                          <span className="badge">
                            Score: {practiceResult.score} / {practiceResult.total}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
                {role === "ADMIN" ? (
                  <div className="card p-5">
                    <h2 className="text-lg font-semibold text-white">Question bank</h2>
                    <div className="mt-3 grid gap-3">
                      {questions.length === 0 ? (
                        <p className="text-sm text-slate-400">No questions yet.</p>
                      ) : (
                        questions.map((question, index) => (
                          <div key={question.id} className="rounded-xl border border-white/10 p-3">
                            <p className="text-sm text-slate-400">Question {index + 1}</p>
                            <p className="text-base font-semibold text-white">{question.text}</p>
                            <p className="text-xs text-slate-400">Source: {question.source}</p>
                            <p className="text-xs text-slate-400">
                              Module: {question.moduleId ? (moduleTitleMap.get(question.moduleId) ?? "Unknown") : "Unassigned"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </AuthGuard>
  );
}
