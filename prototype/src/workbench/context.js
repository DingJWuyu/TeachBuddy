import { createContext, useContext } from "react";

export const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);
export const newId = (prefix) => prefix + "-" + crypto.randomUUID();
