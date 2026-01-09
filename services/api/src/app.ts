import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import {
  authRouter,
  adminRouter,
  coursesRouter,
  examsRouter,
  filesRouter,
  meRouter,
  omrRouter,
  sebRouter,
  usersRouter
} from "./routes";

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "lms-api" });
});

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/", meRouter);
app.use("/users", usersRouter);
app.use("/", coursesRouter);
app.use("/", examsRouter);
app.use("/files", filesRouter);
app.use("/omr", omrRouter);
app.use("/seb", sebRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal Server Error" });
});

export default app;
