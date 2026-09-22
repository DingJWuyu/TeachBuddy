import React, { useState } from "react";
import { writeLocal } from "../workbench/storage.js";
import { useAuth } from "../auth/index.jsx";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import MaterialsQuestionsPage from "./MaterialsQuestionsPage.jsx";
import { AddToLessonDialog } from "./AddToLessonDialog.jsx";
export default function QuestionsPage({ route }) {
  const shell = useWorkbenchShell(),
    auth = useAuth();
  const [questions, setQuestions] = useState(null);
  const [usageRevision, setUsageRevision] = useState(0);
  const openLesson = (lessonId, referenceId, focusTarget) => {
    writeLocal(shell.accountKey, "questions-return-focus", focusTarget);
    setQuestions(null);
    shell.openQuestionUsage(lessonId, referenceId, route.path);
  };
  return (
    <>
      <MaterialsQuestionsPage
        key={`${shell.accountKey}:${shell.generation}`}
        accountKey={shell.accountKey}
        requestedId={route?.id}
        registerTools={shell.registerTools}
        transport={auth.request}
        onAddToLesson={setQuestions}
        onOpenLesson={openLesson}
        usageRevision={usageRevision}
      />
      {questions && (
        <AddToLessonDialog
          accountKey={shell.accountKey}
          questions={questions}
          onClose={() => setQuestions(null)}
          onDone={() => setUsageRevision((value) => value + 1)}
          onOpenLesson={openLesson}
        />
      )}
    </>
  );
}
