import { removeRepo } from "../repo-manager.js";
import type { RepoInfo } from "../types.js";

export function removeRepository(info: RepoInfo): boolean {
  return removeRepo(info);
}
