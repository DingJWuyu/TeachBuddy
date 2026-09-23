import { ModulePresence } from "../workbench/ModuleMotion.jsx";
import React, { useState } from "react";
import { writeLocal } from "../workbench/storage.js";
import { useAuth } from "../auth/index.jsx";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import MaterialsQuestionsPage from "./MaterialsQuestionsPage.jsx";
import { AddToLessonDialog } from "./AddToLessonDialog.jsx";
import { SourceRecordsPanel } from "../classes/index.jsx";
export default function QuestionsPage({ route }) {
  const shell = useWorkbenchShell(),
    auth = useAuth();
  const [questions, setQuestions] = useState(null);
  const [usageRevision, setUsageRevision] = useState(0);
  const fromPath = window.history.state?.fromPath;
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
        onOpenTools={() => shell.openPanel("questions-classification")}
        transport={auth.request}
        onAddToLesson={setQuestions}
        onOpenLesson={openLesson}
        usageRevision={usageRevision}
        onReturnToRecord={fromPath?.startsWith("/classes/") ? () => shell.navigate(fromPath) : undefined}
        renderTeachingFeedback={(id) => <SourceRecordsPanel kind="question" id={id} />}
      />
      <ModulePresence present={Boolean(questions)}>{questions && (
        <AddToLessonDialog
          accountKey={shell.accountKey}
          questions={questions}
          onClose={() => setQuestions(null)}
          onDone={() => setUsageRevision((value) => value + 1)}
          onOpenLesson={openLesson}
        />
      )}</ModulePresence>
    </>
  );
}
