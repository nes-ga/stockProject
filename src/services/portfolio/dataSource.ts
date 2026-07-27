import path from "node:path";
import { config } from "../../config.js";
import type { PortfolioDataSourceInfo, PortfolioDataSourceMode } from "./types.js";

const REPOSITORY_DEVELOPMENT_RELATIVE_DIR = "data/development/portfolio";
const PRIVATE_LOCAL_RELATIVE_DIR = "data/private/portfolio";

type ResolvePortfolioDataSourceInput = {
  cwd: string;
  mode?: string;
  dataDirectory?: string;
  nodeEnv?: string;
  legacyHoldingsPath?: string;
};

export type ResolvedPortfolioDataSource = {
  directoryPath: string;
  holdingsPath: string;
  accountPath: string;
  info: PortfolioDataSourceInfo;
};

function isWithinDirectory(parentPath: string, candidatePath: string) {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseMode(mode?: string, nodeEnv?: string): PortfolioDataSourceMode {
  const normalized =
    mode?.trim().toLowerCase() ||
    (nodeEnv?.trim().toLowerCase() === "production"
      ? "private-local"
      : "repository-development");
  if (normalized === "repository-development" || normalized === "private-local") {
    return normalized;
  }
  throw new Error(
    `PORTFOLIO_DATA_MODE는 repository-development 또는 private-local이어야 합니다. 현재 값: ${normalized}`
  );
}

export function resolvePortfolioDataSource(
  input: ResolvePortfolioDataSourceInput
): ResolvedPortfolioDataSource {
  const projectRoot = path.resolve(input.cwd);
  const repositoryDevelopmentDirectory = path.resolve(
    projectRoot,
    REPOSITORY_DEVELOPMENT_RELATIVE_DIR
  );
  const privateLocalDirectory = path.resolve(projectRoot, PRIVATE_LOCAL_RELATIVE_DIR);
  const mode = parseMode(input.mode, input.nodeEnv);
  const requestedDirectory = input.dataDirectory?.trim();

  if (input.legacyHoldingsPath?.trim()) {
    throw new Error(
      "PORTFOLIO_HOLDINGS_PATH는 더 이상 사용하지 않습니다. holdings와 account가 갈라지지 않도록 PORTFOLIO_DATA_MODE와 PORTFOLIO_DATA_DIR을 함께 사용하세요."
    );
  }

  if (mode === "repository-development") {
    if (input.nodeEnv?.trim().toLowerCase() === "production") {
      throw new Error(
        "운영 환경에서는 repository-development 포트폴리오 원본을 사용할 수 없습니다."
      );
    }

    if (
      requestedDirectory &&
      path.resolve(projectRoot, requestedDirectory) !== repositoryDevelopmentDirectory
    ) {
      throw new Error(
        `repository-development 모드는 ${REPOSITORY_DEVELOPMENT_RELATIVE_DIR}만 사용할 수 있습니다.`
      );
    }

    return {
      directoryPath: repositoryDevelopmentDirectory,
      holdingsPath: path.join(repositoryDevelopmentDirectory, "portfolio-holdings.json"),
      accountPath: path.join(repositoryDevelopmentDirectory, "portfolio-account.json"),
      info: {
        mode,
        label: "Git 개발 데이터",
        displayPath: REPOSITORY_DEVELOPMENT_RELATIVE_DIR,
        versionControlled: true,
        developmentOnly: true,
        readWritePolicy:
          "이 Portfolio 화면은 이 원본만 읽고 저장합니다. private 원본과 자동 동기화하거나 왕복하지 않습니다."
      }
    };
  }

  const resolvedDirectory = requestedDirectory
    ? path.resolve(projectRoot, requestedDirectory)
    : privateLocalDirectory;
  const isInsideProject = isWithinDirectory(projectRoot, resolvedDirectory);

  if (isWithinDirectory(repositoryDevelopmentDirectory, resolvedDirectory)) {
    throw new Error(
      "private-local 모드는 Git 개발 포트폴리오 디렉터리를 가리킬 수 없습니다."
    );
  }

  if (isInsideProject && !isWithinDirectory(privateLocalDirectory, resolvedDirectory)) {
    throw new Error(
      `저장소 내부 private-local 경로는 Git 제외 영역인 ${PRIVATE_LOCAL_RELATIVE_DIR} 아래만 사용할 수 있습니다.`
    );
  }

  if (input.nodeEnv?.trim().toLowerCase() === "production") {
    if (!requestedDirectory || !path.isAbsolute(requestedDirectory) || isInsideProject) {
      throw new Error(
        "운영 환경의 private-local 모드는 저장소 밖 절대경로 PORTFOLIO_DATA_DIR을 반드시 지정해야 합니다."
      );
    }
  }

  return {
    directoryPath: resolvedDirectory,
    holdingsPath: path.join(resolvedDirectory, "portfolio-holdings.json"),
    accountPath: path.join(resolvedDirectory, "portfolio-account.json"),
    info: {
      mode,
      label: "비공개 로컬 데이터",
      displayPath: isInsideProject
        ? `${PRIVATE_LOCAL_RELATIVE_DIR} (Git 제외)`
        : "저장소 외부 비공개 경로",
      versionControlled: false,
      developmentOnly: false,
      readWritePolicy:
        "이 Portfolio 화면은 이 원본만 읽고 저장합니다. Git 개발 원본과 자동 동기화하거나 왕복하지 않습니다."
    }
  };
}

export const portfolioDataSource = resolvePortfolioDataSource({
  cwd: process.cwd(),
  mode: config.portfolioDataMode,
  dataDirectory: config.portfolioDataDir,
  nodeEnv: process.env.NODE_ENV,
  legacyHoldingsPath: config.portfolioLegacyHoldingsPath
});

export function getPortfolioDataSourceInfo(): PortfolioDataSourceInfo {
  return { ...portfolioDataSource.info };
}
