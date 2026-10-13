import React from "react";
import { useAuth } from "../auth/index.jsx";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import MaterialsQuestionsPage from "./MaterialsQuestionsPage.jsx";
import { SourceRecordsPanel } from "../classes/index.jsx";
export default function QuestionsPage({ route }) {
  const shell = useWorkbenchShell(),
    auth = useAuth();
  const fromPath = window.history.state?.fromPath;
  return (
    <>
      <MaterialsQuestionsPage
        key={`${shell.accountKey}:${shell.generation}`}
        accountKey={shell.accountKey}
        requestedId={route?.id}
        registerTools={shell.registerTools}
        onOpenTools={() => shell.openPanel("questions-classification")}
        onReturnToLibrary={() => shell.navigate('/questions', { replace: true })}
        transport={auth.request}
        onReturnToRecord={fromPath?.startsWith("/classes/") ? () => shell.navigate(fromPath) : undefined}
        renderTeachingFeedback={(id) => <SourceRecordsPanel kind="question" id={id} />}
      />
    </>
  );
}
