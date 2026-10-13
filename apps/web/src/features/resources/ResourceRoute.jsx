import { useTranslation } from 'react-i18next';
import { useLayoutEffect, useState } from "react";
import ResourcesPage from "./index.jsx";
import { readLocal, writeLocal } from "../workbench/storage.js";
import { useWorkbenchShell } from "../workbench/shellContext.js";
import { navigate } from "../workbench/routes.js";

/** Adapt the shell deep link to the resource module's account-scoped scene. */
export default function ResourceRoute(props) {
  useTranslation("resources");
  return <ResourceEntry key={props.route.path} {...props} />;
}

function ResourceEntry({ route, transport }) {
  const { t } = useTranslation("resources");
  const { accountKey } = useWorkbenchShell();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useLayoutEffect(() => {
    const consumed = window.history.state?.resourceRoute;
    if (
      route.id &&
      (consumed?.accountKey !== accountKey || consumed?.id !== route.id)
    ) {
      const name = "scene:resources";
      if (
        !writeLocal(accountKey, name, {
          ...readLocal(accountKey, name),
          openId: route.id,
        })
      ) {
        setFailed(true);
        return;
      }
      // Consume this history entry once. Reload restores the resource module's
      // latest scene, including a different resource or its list view.
      window.history.replaceState(
        {
          ...window.history.state,
          resourceRoute: { accountKey, id: route.id },
        },
        "",
      );
    }
    setFailed(false);
    setReady(true);
  }, [accountKey, route.id, retry]);
  if (failed)
    return (
      <div className="wb-page wb-inline-error" role="alert">
        <p>{t("无法打开指定资料，请允许本地存储后重试。")}</p>
        <button
          className="wb-button"
          onClick={() => setRetry((value) => value + 1)}
        > {t("重试打开资料")} </button>
      </div>
    );
  return (
    ready && (
      <ResourcesPage
        transport={transport}
      />
    )
  );
}
