import { Link, useParams, Navigate } from "react-router-dom";
import { getSubject } from "@/data/subjects";
import { PageHeader } from "@/components/PageHeader";
import { AgeBadge } from "@/components/AgePicker";
import { useAge, topicForAge } from "@/lib/age";
import { useSubscription } from "@/hooks/useSubscription";
import { isTopicFree } from "@/lib/premium";
import type { SubjectId } from "@/data/types";
import { Lock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const Subject = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const subject = getSubject(subjectId as SubjectId);
  const [age] = useAge();
  const { isPremium } = useSubscription();
  if (!subject) return <Navigate to="/" replace />;

  const topics = subject.topics.filter((t) => topicForAge(t, age));

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/30 to-background">
      <main className="container mx-auto max-w-2xl px-4 pb-16">
        <PageHeader title={subject.title} backTo="/" centered />

        <AgeBadge />

        <div className={`${subject.bgVar} mb-6 rounded-3xl p-6 text-center text-white shadow-card animate-bounce-in`}>
          <div className="text-6xl mb-2">{subject.emoji}</div>
          <h1 className="text-3xl font-extrabold text-shadow-soft">{subject.title}</h1>
          <p className="text-sm font-semibold opacity-90 mt-1">{subject.description}</p>
        </div>

        {topics.length === 0 ? (
          <p className="text-center text-muted-foreground font-bold py-12">
            Bu yaş için konu yok. Üstteki yaş düğmelerinden değiştir.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topics.map((t, i) => {
              const free = isTopicFree(subject.id, t.id);
              const locked = !free && !isPremium;
              const to = locked ? "/abonelik" : `/konu/${subject.id}/${t.id}`;
              return (
                <Link
                  key={t.id}
                  to={to}
                  className={cn(
                    "group relative flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant border-2 border-border/40 animate-bounce-in",
                    locked && "opacity-80",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="text-4xl">{t.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                      {t.title}
                      {locked && <Lock className="h-3.5 w-3.5 text-warning" />}
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {locked ? "Premium ile aç" : t.description}
                    </p>
                  </div>
                  {locked && (
                    <div className="rounded-full bg-warning/20 p-2">
                      <Crown className="h-4 w-4 text-warning" />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Subject;
