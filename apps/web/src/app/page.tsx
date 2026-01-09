import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid gap-10">
      <section className="grid gap-6">
        <p className="text-sm uppercase tracking-[0.4em] text-primary-200/70">
          Learning Platform
        </p>
        <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight text-white md:text-5xl">
          Organize courses, deliver exams, and keep learners on track.
        </h1>
        <p className="max-w-xl text-lg text-slate-300">
          A focused LMS interface for instructors and students. Upload materials,
          run Safe Exam Browser checks, and access course content from one place.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/courses" className="btn">
            View Courses
          </Link>
          <Link href="/login" className="btn-secondary">
            Sign In
          </Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
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
        ].map((card) => (
          <div key={card.title} className="card p-6">
            <h3 className="text-lg font-semibold text-white">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{card.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
