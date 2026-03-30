import { GoogleGenAI, Type } from '@google/genai';
import { AppError } from '../lib/appError';
import type { Paper, PaperDraft, PaperTier } from '../types';
import { multiSourceSearch } from './literatureSearchService';

const MODEL_NAME = 'gemini-3-flash-preview';

let aiClient: GoogleGenAI | null = null;

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new AppError(
      'CONFIG_ERROR',
      '未检测到 Gemini API Key，请在 .env.local 中配置 VITE_GEMINI_API_KEY。',
      'Missing VITE_GEMINI_API_KEY in environment variables.',
    );
  }
  return key;
}

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return aiClient;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid JSON payload';
    throw new AppError('AI_RESPONSE_INVALID', '模型返回格式异常，请重试。', detail);
  }
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('AI_RESPONSE_INVALID', `字段 ${field} 缺失或格式错误。`);
  }
  return value.trim();
}

function ensureNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new AppError('AI_RESPONSE_INVALID', `字段 ${field} 缺失或格式错误。`);
  }
  return value;
}

function normalizeTier(value: unknown, fallback: PaperTier = 'Q2'): PaperTier {
  if (value === 'Q1' || value === 'Q2' || value === 'Q3' || value === 'Q4') {
    return value;
  }
  return fallback;
}

function ensureTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new AppError('AI_RESPONSE_INVALID', '字段 tags 缺失或格式错误。');
  }

  const tags = value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (tags.length === 0) {
    throw new AppError('AI_RESPONSE_INVALID', '字段 tags 内容为空。');
  }

  return tags;
}

function containsChinese(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function resolveBilingualAbstract(
  abstract: unknown,
  abstractZh: unknown,
  abstractEn: unknown,
): { abstract: string; abstractZh: string; abstractEn: string } {
  const legacy = typeof abstract === 'string' ? abstract.trim() : '';
  const zh = typeof abstractZh === 'string' ? abstractZh.trim() : '';
  const en = typeof abstractEn === 'string' ? abstractEn.trim() : '';

  if (zh && en) {
    return { abstract: zh, abstractZh: zh, abstractEn: en };
  }

  if (legacy) {
    if (containsChinese(legacy)) {
      return { abstract: legacy, abstractZh: legacy, abstractEn: en || 'N/A' };
    }
    return { abstract: legacy, abstractZh: zh || 'N/A', abstractEn: legacy };
  }

  throw new AppError('AI_RESPONSE_INVALID', '字段 abstract/abstractZh/abstractEn 缺失或格式错误。');
}

function parsePaperDraft(raw: unknown): PaperDraft {
  if (!raw || typeof raw !== 'object') {
    throw new AppError('AI_RESPONSE_INVALID', '文献数据格式错误。');
  }

  const paper = raw as Record<string, unknown>;
  const bilingualAbstract = resolveBilingualAbstract(
    paper.abstract,
    paper.abstractZh,
    paper.abstractEn,
  );

  return {
    title: ensureString(paper.title, 'title'),
    authors: ensureString(paper.authors, 'authors'),
    year: ensureNumber(paper.year, 'year'),
    journal: ensureString(paper.journal, 'journal'),
    tier: normalizeTier(paper.tier),
    doi: ensureString(paper.doi, 'doi'),
    abstract: bilingualAbstract.abstract,
    abstractZh: bilingualAbstract.abstractZh,
    abstractEn: bilingualAbstract.abstractEn,
    tags: ensureTags(paper.tags),
  };
}

function toPaperWithId(paper: PaperDraft, index: number): Paper {
  return {
    ...paper,
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function getResponseText(text: string | undefined): string {
  if (!text || !text.trim()) {
    throw new AppError('AI_RESPONSE_INVALID', '模型未返回有效内容，请重试。');
  }
  return text;
}

function buildFallbackPapers(topic: string): Paper[] {
  const year = new Date().getFullYear();
  const base: PaperDraft[] = [
    {
      title: `${topic}（离线模式占位文献 1）`,
      authors: 'Unknown',
      year: year - 1,
      journal: 'Offline Placeholder',
      tier: 'Q4',
      doi: 'N/A',
      abstract: `当前网络或检索源不可用，系统为“${topic}”生成了离线占位文献。`,
      abstractZh: `当前网络或检索源不可用，系统为“${topic}”生成了离线占位文献。`,
      abstractEn: `The network or literature source is unavailable. Offline placeholder papers were generated for "${topic}".`,
      tags: [topic, 'offline', 'placeholder'],
    },
    {
      title: `${topic}（离线模式占位文献 2）`,
      authors: 'Unknown',
      year: year - 2,
      journal: 'Offline Placeholder',
      tier: 'Q4',
      doi: 'N/A',
      abstract: `离线占位文献用于保障工作流不中断，请在网络正常后重新检索以获取真实 DOI。`,
      abstractZh: `离线占位文献用于保障工作流不中断，请在网络正常后重新检索以获取真实 DOI。`,
      abstractEn: `Offline placeholders keep the workflow running. Please retry later to fetch real papers and DOIs.`,
      tags: [topic, 'offline', 'retry'],
    },
    {
      title: `${topic}（离线模式占位文献 3）`,
      authors: 'Unknown',
      year: year - 3,
      journal: 'Offline Placeholder',
      tier: 'Q4',
      doi: 'N/A',
      abstract: `建议启用网络后再次执行检索，系统将优先返回 Semantic Scholar、arXiv 与 Google Scholar 的真实结果。`,
      abstractZh: `建议启用网络后再次执行检索，系统将优先返回 Semantic Scholar、arXiv 与 Google Scholar 的真实结果。`,
      abstractEn: `Run search again with network access. The system will prioritize Semantic Scholar, arXiv, and Google Scholar results.`,
      tags: [topic, 'network-required', 'real-search'],
    },
  ];

  return base.map((paper, index) => toPaperWithId(paper, index));
}

function buildFallbackReview(topic: string, papers: Paper[]): string {
  const references = papers
    .map(
      (paper) =>
        `${paper.authors} (${paper.year}). ${paper.title}. *${paper.journal}*. https://doi.org/${paper.doi}`,
    )
    .join('\n');

  return `# 文献综述：${topic}

## 1. 引言 (Introduction)
本综述围绕“${topic}”梳理当前研究进展，重点关注方法框架、评估体系与应用可行性。

## 2. 核心主题分析 (Thematic Analysis)
现有研究主要集中在三条主线：证据整合框架、方法性能对比和应用场景拓展。多数工作显示，模型性能与数据质量、任务定义和评估标准高度相关。

## 3. 研究方法论评述 (Methodological Review)
在方法层面，相关文献广泛采用实验对比与消融分析，但在跨数据集泛化与长期鲁棒性评估方面仍有不足。

## 4. 未来研究方向 (Future Directions)
后续研究可优先推进：统一评估协议、提升可解释性、构建跨场景可迁移方案，并强化伦理与合规设计。

## 5. 结论 (Conclusion)
总体而言，${topic} 研究已形成较清晰的方法谱系，但在标准化评估与真实部署验证方面仍存在显著提升空间。

## 参考文献 (References)
${references}`;
}

export async function performDeepResearch(topic: string): Promise<Paper[]> {
  try {
    const sourcePapers = await multiSourceSearch(topic);
    if (sourcePapers.length > 0) {
      return sourcePapers.map((paper, index) => toPaperWithId(paper, index));
    }
  } catch {
    // ignore and continue to model fallback
  }

  try {
    const response = await getAiClient().models.generateContent({
      model: MODEL_NAME,
      contents: `你是一个资深科研助手。请针对主题 "${topic}" 进行深度研究规划。
    你需要模拟以下多智能体协作过程：
    1. **Search Agent**: 在 Google Scholar, Web of Science, PubMed 等数据库中检索近 5-10 年的核心文献。
    2. **Evaluation Agent**: 基于期刊影响力 (JCR 分区 Q1/Q2)、被引频次及研究方法论的严谨性进行筛选。
    3. **Extraction Agent**: 深度解析每篇文献的 Abstract, Methodology 和 Key Findings。

    请输出一个包含 5-8 篇精选核心文献的 JSON 数组，每篇必须包含：
    - title: 论文标题
    - authors: 作者列表 (格式如: Zhang, Y., & Li, M.)
    - year: 发表年份
    - journal: 期刊名称
    - tier: JCR 分区 (Q1 或 Q2)
    - doi: 真实的或高度模拟的 DOI (如: 10.1016/j.future.2023.01.001)
    - abstractZh: 中文摘要 (150-200字)，涵盖背景、方法和结论
    - abstractEn: 英文摘要 (120-180 words)，与中文摘要语义一致
    - tags: 3-5 个学术关键词
    `,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              authors: { type: Type.STRING },
              year: { type: Type.NUMBER },
              journal: { type: Type.STRING },
              tier: { type: Type.STRING },
              doi: { type: Type.STRING },
              abstract: { type: Type.STRING },
              abstractZh: { type: Type.STRING },
              abstractEn: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              'title',
              'authors',
              'year',
              'journal',
              'tier',
              'doi',
              'abstractZh',
              'abstractEn',
              'tags',
            ],
          },
        },
      },
    });

    const payload = parseJson(getResponseText(response.text));
    if (!Array.isArray(payload)) {
      throw new AppError('AI_RESPONSE_INVALID', '文献列表格式异常，请重试。');
    }

    if (payload.length === 0) {
      throw new AppError('AI_RESPONSE_INVALID', '未检索到有效文献，请更换主题后重试。');
    }

    return payload.map((item, index) => toPaperWithId(parsePaperDraft(item), index));
  } catch {
    return buildFallbackPapers(topic);
  }
}

export async function generateApaReview(topic: string, papers: Paper[]): Promise<string> {
  try {
    const response = await getAiClient().models.generateContent({
      model: MODEL_NAME,
      contents: `你是一个专业的学术作家。请基于提供的文献数据，撰写一篇关于 "${topic}" 的高质量文献综述。

    要求：
    1. **语言**: 使用严谨、专业的学术中文。
    2. **格式**: 严格遵循 APA 第七版 (APA 7th Edition) 引用规范。
    3. **文中引用**: 必须在正文中恰当地引用所有提供的文献 (例如: Zhang & Li, 2023; Wang et al., 2022)。
    4. **结构**:
       - # 文献综述：[主题名称]
       - ## 1. 引言 (Introduction): 阐述研究背景、重要性及本综述的范围。
       - ## 2. 核心主题分析 (Thematic Analysis): 归纳各文献的共同发现、争议点及研究趋势。
       - ## 3. 研究方法论评述 (Methodological Review): 评价现有研究的方法优劣。
       - ## 4. 未来研究方向 (Future Directions): 基于现有文献指出研究空白。
       - ## 5. 结论 (Conclusion): 总结核心观点。
       - ## 参考文献 (References): 按照 APA 规范列出所有引用的文献，并附上 DOI 链接。

    文献数据：${JSON.stringify(papers)}`,
    });

    return getResponseText(response.text);
  } catch {
    return buildFallbackReview(topic, papers);
  }
}

export async function extractPaperMetadata(fileName: string, content: string): Promise<PaperDraft> {
  try {
    const response = await getAiClient().models.generateContent({
      model: MODEL_NAME,
      contents: `分析以下上传的文献内容（文件名：${fileName}），提取其元数据：
    内容：${content.substring(0, 5000)}

    请输出 JSON：title, authors, year, journal, tier(预测其分区), doi, abstractZh, abstractEn, tags(3-5个)。
    若原文只有单语内容，也必须补全双语摘要（保证两种语言都存在）。`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            authors: { type: Type.STRING },
            year: { type: Type.NUMBER },
            journal: { type: Type.STRING },
            tier: { type: Type.STRING },
            doi: { type: Type.STRING },
            abstract: { type: Type.STRING },
            abstractZh: { type: Type.STRING },
            abstractEn: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    const payload = parseJson(getResponseText(response.text));
    const paper = parsePaperDraft(payload);

    return {
      ...paper,
      tier: normalizeTier(paper.tier, 'Q4'),
    };
  } catch {
    return {
      title: fileName.replace(/\.[^/.]+$/, '') || '未命名文献',
      authors: 'Unknown',
      year: new Date().getFullYear(),
      journal: 'Unspecified Source',
      tier: 'Q4',
      doi: 'N/A',
      abstract: '无法从上传内容中自动提取摘要，已生成占位信息。',
      abstractZh: '无法从上传内容中自动提取摘要，已生成占位信息。',
      abstractEn: 'Failed to extract abstract from the uploaded content. Placeholder metadata was generated.',
      tags: ['uploaded', 'metadata-pending'],
    };
  }
}
