"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthGuard from "../../components/AuthGuard";
import {
  checkSeb,
  fetchCourses,
  fetchRandomCourseQuestions,
  submitCourseExam,
  getUserRole,
  type QuestionBank,
  type UserRole
} from "../../modules/api";

type SebStatus = "loading" | "ok" | "blocked";
type MediaStatus = "idle" | "granted" | "error";
type FaceStatus = "idle" | "loading" | "running" | "error";
type FaceDetectorLike = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { detections?: unknown[] };
  close?: () => void;
};
type NativeFaceDetectorLike = {
  detect: (video: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};
type MediaPipeDetection = {
  boundingBox?: { xMin: number; yMin: number; width: number; height: number };
};
type MediaPipeFaceDetectionLike = {
  setOptions: (options: { model: "short" | "full"; minDetectionConfidence?: number }) => void;
  onResults: (callback: (results: { detections?: MediaPipeDetection[] }) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close?: () => void;
};

type BoundingBox = { originX: number; originY: number; width: number; height: number };

const FACE_DETECTION_INTERVAL_MS = 500;
const MEDIAPIPE_FACE_DETECTION_JS =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js";
const MEDIAPIPE_FACE_DETECTION_ASSETS = "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection";
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

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export default function SebPage() {
  const searchParams = useSearchParams();
  const sebOverride = searchParams.get("seb") === "1";
  const [status, setStatus] = useState<SebStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("idle");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("idle");
  const [faceError, setFaceError] = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [multiFaceDetected, setMultiFaceDetected] = useState(false);
  const [examCourseId, setExamCourseId] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<QuestionBank[]>([]);
  const [examAnswers, setExamAnswers] = useState<Record<string, number>>({});
  const [examLoading, setExamLoading] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [examResult, setExamResult] = useState<{ score: number; total: number } | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const nativeFaceDetectorRef = useRef<NativeFaceDetectorLike | null>(null);
  const mediapipeDetectorRef = useRef<MediaPipeFaceDetectionLike | null>(null);
  const mediapipeDetectionsRef = useRef<MediaPipeDetection[]>([]);
  const detectionActiveRef = useRef(false);
  const lastDetectionRef = useRef(0);
  const lastFaceCountRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setRole(getUserRole());

    if (sebOverride) {
      setError(null);
      setStatus("ok");
      return;
    }

    const runCheck = async () => {
      setError(null);
      try {
        await checkSeb();
        setStatus("ok");
      } catch (err) {
        const message = err instanceof Error ? err.message : "SEB check failed";
        setError(message);
        setStatus("blocked");
      }
    };

    runCheck();
  }, [sebOverride]);

  useEffect(() => {
    if (status !== "ok" && !sebOverride) {
      return;
    }
    let active = true;
    fetchCourses()
      .then((courses) => {
        if (!active) {
          return;
        }
        const course = courses.find((item) =>
          item.title.replace(/\s+/g, "").toUpperCase().startsWith("YZM101")
        );
        setExamCourseId(course?.id ?? null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load courses";
        setExamError(message);
      });

    return () => {
      active = false;
    };
  }, [status, sebOverride]);

  useEffect(() => {
    return () => {
      detectionActiveRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (faceDetectorRef.current?.close) {
        faceDetectorRef.current.close();
      }
      faceDetectorRef.current = null;
      nativeFaceDetectorRef.current = null;
      if (mediapipeDetectorRef.current?.close) {
        mediapipeDetectorRef.current.close();
      }
      mediapipeDetectorRef.current = null;
      mediapipeDetectionsRef.current = [];
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const loadFaceDetector = async () => {
    if (faceDetectorRef.current || nativeFaceDetectorRef.current) {
      return;
    }
    setFaceStatus("loading");
    setFaceError(null);
    try {
      if ("FaceDetector" in window) {
        nativeFaceDetectorRef.current = new (window as Window & {
          FaceDetector: new (options?: { maxDetectedFaces?: number; fastMode?: boolean }) => NativeFaceDetectorLike;
        }).FaceDetector({ maxDetectedFaces: 5, fastMode: true });
        return;
      }
      await loadScript(MEDIAPIPE_FACE_DETECTION_JS);
      const FaceDetectionCtor = (window as Window & {
        FaceDetection?: new (options: { locateFile: (file: string) => string }) => MediaPipeFaceDetectionLike;
      }).FaceDetection;
      if (!FaceDetectionCtor) {
        throw new Error("Face Detection not implemented");
      }
      const detector = new FaceDetectionCtor({
        locateFile: (file: string) => `${MEDIAPIPE_FACE_DETECTION_ASSETS}/${file}`
      });
      detector.setOptions({ model: "short", minDetectionConfidence: 0.5 });
      detector.onResults((results) => {
        mediapipeDetectionsRef.current = results.detections ?? [];
      });
      mediapipeDetectorRef.current = detector;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Face detector load failed";
      setFaceStatus("error");
      setFaceError(message);
      throw err;
    }
  };

  const stopFaceDetection = () => {
    detectionActiveRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startFaceDetection = async () => {
    await loadFaceDetector();
    detectionActiveRef.current = true;
    setFaceStatus("running");

    const loop = async (timestamp: number) => {
      if (!detectionActiveRef.current) {
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && video.readyState >= 2) {
        if (timestamp - lastDetectionRef.current >= FACE_DETECTION_INTERVAL_MS) {
          lastDetectionRef.current = timestamp;
          try {
            let detections: Array<{ boundingBox?: BoundingBox }> = [];
            if (nativeFaceDetectorRef.current) {
              const nativeDetections = await nativeFaceDetectorRef.current.detect(video);
              detections = nativeDetections.map((detection) => ({
                boundingBox: {
                  originX: detection.boundingBox.x,
                  originY: detection.boundingBox.y,
                  width: detection.boundingBox.width,
                  height: detection.boundingBox.height
                }
              }));
            } else if (mediapipeDetectorRef.current) {
              await mediapipeDetectorRef.current.send({ image: video });
              detections = mediapipeDetectionsRef.current.map((detection) => ({
                boundingBox: detection.boundingBox
                  ? {
                      originX: detection.boundingBox.xMin,
                      originY: detection.boundingBox.yMin,
                      width: detection.boundingBox.width,
                      height: detection.boundingBox.height
                    }
                  : undefined
              }));
            } else {
              const result = faceDetectorRef.current?.detectForVideo(video, timestamp);
              detections = (result?.detections ?? []) as Array<{ boundingBox?: BoundingBox }>;
            }
            const count = detections.length;
            if (lastFaceCountRef.current !== count) {
              lastFaceCountRef.current = count;
              setFaceCount(count);
              setMultiFaceDetected(count >= 2);
            }
            if (canvas) {
              const width = video.videoWidth || video.clientWidth;
              const height = video.videoHeight || video.clientHeight;
              if (width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
              }
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 2;
                ctx.strokeStyle = count >= 2 ? "#f87171" : "#34d399";
                detections.forEach((detection) => {
                  const box = detection.boundingBox;
                  if (!box) {
                    return;
                  }
                  ctx.strokeRect(box.originX, box.originY, box.width, box.height);
                });
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Face detection failed";
            setFaceStatus("error");
            setFaceError(message);
            detectionActiveRef.current = false;
          }
        }
      }
      rafRef.current = requestAnimationFrame((nextTimestamp) => {
        void loop(nextTimestamp);
      });
    };

    rafRef.current = requestAnimationFrame((timestamp) => {
      void loop(timestamp);
    });
  };

  const handleMediaTest = async () => {
    setMediaStatus("idle");
    setMediaError(null);
    setFaceStatus("idle");
    setFaceError(null);
    setFaceCount(null);
    setMultiFaceDetected(false);
    stopFaceDetection();
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
      setMediaStatus("granted");
      await startFaceDetection();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera/microphone access failed";
      setMediaStatus("error");
      setMediaError(message);
      setFaceStatus("error");
      setFaceError(message);
    }
  };

  const handleLoadExam = async () => {
    if (!examCourseId) {
      setExamError("Exam course not found.");
      return;
    }
    setExamLoading(true);
    setExamError(null);
    try {
      const data = await fetchRandomCourseQuestions(examCourseId, 10);
      setExamQuestions(data);
      setExamAnswers({});
      setExamResult(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load exam questions";
      setExamError(message);
    } finally {
      setExamLoading(false);
    }
  };

  const handleExamAnswerChange = (questionId: string, value: number) => {
    setExamAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitExam = async () => {
    if (!examCourseId) {
      setExamError("Exam course not found.");
      return;
    }
    const unanswered = examQuestions.some((question) => examAnswers[question.id] === undefined);
    if (unanswered) {
      setExamError("Please answer all questions before submitting.");
      return;
    }

    setExamSubmitting(true);
    setExamError(null);
    try {
      const answers = examQuestions.map((question) => ({
        questionId: question.id,
        answer: examAnswers[question.id] ?? -1
      }));
      const result = await submitCourseExam(examCourseId, { answers });
      setExamResult({ score: result.score, total: result.total });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit exam";
      setExamError(message);
    } finally {
      setExamSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <div className="grid gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-white">Safe Exam Browser</h1>
          <p className="mt-2 text-slate-300">
            Your exam session requires Safe Exam Browser to proceed.
          </p>
        </div>
        <div className="card p-6">
          {role === "STUDENT" ? (
            <p className="mb-4 text-sm text-slate-300">
              Students must verify SEB status before starting an exam.
            </p>
          ) : null}
          {status === "loading" ? (
            <p className="text-slate-300">Checking SEB status...</p>
          ) : null}
          {status === "ok" ? (
            <p className="text-emerald-300">
              Safe Exam Browser detected. You may start the exam.
            </p>
          ) : null}
          {status === "blocked" ? (
            <p className="text-rose-300">This exam requires Safe Exam Browser.</p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
          {sebOverride ? (
            <p className="mt-2 text-xs text-amber-200">
              SEB override enabled via URL parameter.
            </p>
          ) : null}
          <div className="mt-4 text-sm text-slate-300">
            <a className="text-emerald-300 underline" href="/lmsexam3.seb">
              Download SEB config (.seb)
            </a>
            <span className="ml-2 text-slate-400">
              Use this file to open the exam in Safe Exam Browser.
            </span>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white">SEB Exam</h2>
          <p className="mt-2 text-sm text-slate-300">
            Random 10 questions from YZM101 Programlamaya Giris. Results are saved automatically.
          </p>
          {status !== "ok" && !sebOverride ? (
            <p className="mt-3 text-sm text-rose-300">Safe Exam Browser required to start the exam.</p>
          ) : null}
          {role && role !== "STUDENT" ? (
            <p className="mt-3 text-sm text-amber-300">Exam is only available for students.</p>
          ) : null}
          {examError ? <p className="mt-2 text-sm text-rose-300">{examError}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleLoadExam}
              disabled={(status !== "ok" && !sebOverride) || role !== "STUDENT" || !examCourseId || examLoading}
            >
              {examLoading ? "Loading..." : "Load exam questions"}
            </button>
            {examResult ? (
              <span className="badge">
                Score: {Math.round((examResult.score / examResult.total) * 100)} / 100
              </span>
            ) : null}
          </div>
          {examQuestions.length > 0 ? (
            <div className="mt-4 grid gap-4">
              {examQuestions.map((question, index) => (
                <div key={question.id} className="rounded-xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">Question {index + 1}</p>
                      <p className="text-base font-semibold text-white">{question.text}</p>
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
                          name={`exam-${question.id}`}
                          value={optionIndex}
                          checked={examAnswers[question.id] === optionIndex}
                          onChange={() => handleExamAnswerChange(question.id, optionIndex)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn"
                  onClick={handleSubmitExam}
                  disabled={examSubmitting}
                >
                  {examSubmitting ? "Submitting..." : "Submit exam"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-white">Camera & Microphone Test</h2>
          <p className="mt-2 text-sm text-slate-300">
            Check device availability for proctored sessions. No recording or storage.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={handleMediaTest}>
              Test Camera & Microphone
            </button>
            {mediaStatus === "granted" ? (
              <span className="badge bg-emerald-500/15 text-emerald-200">
                Camera and microphone access granted
              </span>
            ) : null}
          </div>
          {mediaStatus === "error" && mediaError ? (
            <p className="mt-2 text-sm text-rose-300">{mediaError}</p>
          ) : null}
          {faceStatus === "loading" ? (
            <p className="mt-2 text-sm text-slate-300">Loading face detector...</p>
          ) : null}
          {faceStatus === "error" && faceError ? (
            <p className="mt-2 text-sm text-rose-300">{faceError}</p>
          ) : null}
          {faceStatus === "running" && faceCount !== null ? (
            <div className="mt-3">
              <span
                className={`badge ${
                  multiFaceDetected
                    ? "bg-rose-500/15 text-rose-200"
                    : "bg-emerald-500/15 text-emerald-200"
                }`}
              >
                Faces detected: {faceCount}
              </span>
              {multiFaceDetected ? (
                <p className="mt-2 text-sm text-rose-300">
                  Multiple faces detected. Please ensure only one person is visible.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4">
            <div className="relative w-full max-w-xl">
              <video
                ref={videoRef}
                className="aspect-video w-full rounded-xl border border-white/10 bg-slate-900/60"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
