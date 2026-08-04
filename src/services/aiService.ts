import { supabase } from './supabase'
import type { ChatMessage } from '@/stores/aiChatStore'
import referentielData from '@/data/referentiel_v3_0.json'
import type { Referentiel, DimensionDef } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatWithAiRequest {
  messages: Array<{ role: string; content: string }>
  currentDimension: string | null
  currentCriterion: string | null
  referentielContext: string
}

interface ChatWithAiResponse {
  response: string
  mock: boolean
}

// ── Build referentiel context string ─────────────────────────────────────────

function buildReferentielContext(
  dimensionCode: string | null,
  criterionCode: string | null,
): string {
  const ref = referentielData as Referentiel

  if (!dimensionCode) {
    return `GSAT V3.0 has ${String(ref.dimensions.length)} dimensions with criteria covering all aspects of NSO assessment.`
  }

  const dim = ref.dimensions.find(d => d.code === dimensionCode)
  if (!dim) return ''

  let context = `Current dimension: ${dim.code} - ${dim.nom.en} (${dim.nom.fr})\n`
  context += `Number of criteria: ${String(dim.criteres.filter(c => c.actif).length)}\n`
  context += `Essential criteria: ${String(dim.criteres.filter(c => c.essentiel && c.actif).length)}\n\n`

  if (criterionCode) {
    const crit = dim.criteres.find(c => c.code === criterionCode)
    if (crit) {
      context += `Current criterion: ${crit.code}\n`
      context += `Essential: ${crit.essentiel ? 'Yes' : 'No'}\n`
      context += `EN: ${crit.libelle.en}\n`
      context += `FR: ${crit.libelle.fr}\n`
      if (crit.guideInterpretation?.en) {
        context += `Guide (EN): ${crit.guideInterpretation.en}\n`
      }
      if (crit.guideInterpretation?.fr) {
        context += `Guide (FR): ${crit.guideInterpretation.fr}\n`
      }
    }
  } else {
    context += 'Criteria in this dimension:\n'
    for (const c of dim.criteres.filter(cr => cr.actif)) {
      context += `- ${c.code}${c.essentiel ? ' [ESSENTIAL]' : ''}: ${c.libelle.en}\n`
    }
  }

  return context
}

// ── Mock response generator ──────────────────────────────────────────────────

function getDimensionInfo(code: string): DimensionDef | undefined {
  const ref = referentielData as Referentiel
  return ref.dimensions.find(d => d.code === code)
}

function generateMockResponse(
  userMessage: string,
  dimensionCode: string | null,
  criterionCode: string | null,
): string {
  const lower = userMessage.toLowerCase()
  const ref = referentielData as Referentiel

  // Quick action: Analyze Evidence
  if (lower.includes('analyze evidence') || lower.includes('analyser les preuves')) {
    const dim = dimensionCode ? getDimensionInfo(dimensionCode) : null
    const dimName = dim ? dim.nom.en : 'the selected dimension'
    return `## Evidence Analysis Guide for ${dimName}

When analyzing evidence for GSAT assessment, follow these key steps:

- **Document Authenticity**: Verify that all submitted documents are official and up-to-date
- **Relevance**: Ensure each piece of evidence directly addresses the criterion requirements
- **Completeness**: Check that evidence covers all aspects mentioned in the criterion description
- **Currency**: Documents should be from the current assessment period (typically last 3-5 years)

### Recommended Evidence Types

1. **Official documents**: Constitution, policies, annual reports
2. **Meeting minutes**: Board meetings, general assemblies
3. **Financial records**: Audited financial statements, budgets
4. **Programme documentation**: Youth programme frameworks, training curricula
5. **External verification**: Audit reports, third-party assessments

Would you like me to provide specific evidence recommendations for a particular criterion?`
  }

  // Quick action: Explain Dimension
  if (lower.includes('explain dim') || lower.includes('expliquer dim') || lower.includes('expliquer la dim')) {
    const dimMatch = lower.match(/dim(?:ension)?\.?\s*(\d+)/i)
    const dimCode = dimMatch ? `D${dimMatch[1]?.padStart(2, '0')}` : dimensionCode
    const dim = dimCode ? getDimensionInfo(dimCode) : null

    if (dim) {
      const essentials = dim.criteres.filter(c => c.essentiel && c.actif)
      const nonEssentials = dim.criteres.filter(c => !c.essentiel && c.actif)
      return `## ${dim.code}: ${dim.nom.en}
*${dim.nom.fr}*

This dimension contains **${String(dim.criteres.filter(c => c.actif).length)} active criteria**, of which **${String(essentials.length)} are essential**.

### Essential Criteria (must score >= 1)
${essentials.map(c => `- **${c.code}**: ${c.libelle.en}`).join('\n')}

### Non-Essential Criteria
${nonEssentials.map(c => `- **${c.code}**: ${c.libelle.en}`).join('\n')}

### Key Points
- Essential criteria scored 0 are flagged as "KO" and require mandatory justification
- A dimension score is calculated as: (sum of all criterion scores / max possible) x 100
- Focus on essential criteria first, then address non-essential ones

Would you like me to explain the scoring rubric for a specific criterion?`
    }

    return `I can explain any of the 10 GSAT dimensions. Please specify which dimension you'd like to learn about (e.g., "Explain Dimension 3" or "Explain D03").

The 10 GSAT V3.0 dimensions are:
${ref.dimensions.map(d => `- **${d.code}**: ${d.nom.en}`).join('\n')}`
  }

  // Quick action: Score
  if (lower.includes('score a') || lower.includes('score de') || lower.includes('scoring')) {
    const scoreMatch = lower.match(/score\s+(?:a\s+|de\s+)?(\d)/i)
    const targetScore = scoreMatch ? scoreMatch[1] : null

    if (targetScore) {
      return `## What a Score of ${targetScore} Means

### Scoring Rubric

| Score | Level | Description |
|-------|-------|-------------|
| **0** | Non-compliant | No evidence or practice exists. The NSO does not meet this criterion at all. |
| **1** | Partially compliant | Some initial steps have been taken, but implementation is incomplete or inconsistent. |
| **2** | Mostly compliant | Good implementation with minor gaps. The NSO substantially meets the criterion. |
| **3** | Fully compliant | Complete and effective implementation. The criterion is fully met with strong evidence. |

### To Achieve Score ${targetScore}

${targetScore === '0' ? '**Score 0** indicates the criterion is not being met. This is the starting point and requires immediate attention, especially for essential criteria.' : ''}${targetScore === '1' ? '**Score 1** requires:\n- Basic awareness of the requirement\n- Initial steps taken toward implementation\n- At least some documentation, even if informal\n- Partial coverage of the criterion requirements' : ''}${targetScore === '2' ? '**Score 2** requires:\n- Systematic implementation of the criterion\n- Documented policies and procedures\n- Regular monitoring and review\n- Evidence of broad organizational adoption\n- Minor improvements still needed' : ''}${targetScore === '3' ? '**Score 3** requires:\n- Full and effective implementation\n- Comprehensive documentation and evidence\n- Regular review and continuous improvement\n- Best practices adopted organization-wide\n- External validation where applicable' : ''}

Would you like specific guidance for a particular criterion?`
    }
  }

  // Quick action: Methodology FAQ
  if (lower.includes('methodology') || lower.includes('methodologie') || lower.includes('faq')) {
    return `## GSAT V3.0 Methodology FAQ

### What is the GSAT?
The **Global Scout Assessment Tool (GSAT)** is the official self-assessment framework of the World Organization of the Scout Movement (WOSM). Version 3.0 provides a comprehensive evaluation of NSO organizational health.

### Structure
- **10 Dimensions** covering all aspects of NSO operations
- **105 Criteria** with clear scoring rubrics
- **Essential Criteria** that carry extra weight in the assessment

### Scoring System
- Each criterion is scored from **0 to 3**
- **0** = Non-compliant, **1** = Partial, **2** = Mostly compliant, **3** = Fully compliant
- Essential criteria scored 0 are flagged as **KO** (critical finding)

### Assessment Process
1. **Self-Assessment**: The NSO evaluates its own practices
2. **Evidence Collection**: Supporting documents are gathered
3. **Scoring**: Each criterion is rated 0-3 with justification
4. **Review**: Results are reviewed at OSN/WOSM level
5. **Action Plan**: Improvement actions are planned for weak areas

### Key Principles
- **Honest assessment** is more valuable than high scores
- **Evidence-based** scoring ensures objectivity
- **Continuous improvement** is the ultimate goal
- Results are used for **capacity building**, not ranking

Need more details on any specific aspect?`
  }

  // Context-aware response based on current dimension
  if (dimensionCode) {
    const dim = getDimensionInfo(dimensionCode)
    if (dim) {
      if (criterionCode) {
        const crit = dim.criteres.find(c => c.code === criterionCode)
        if (crit) {
          return `## Criterion ${crit.code} Analysis
*${dim.code}: ${dim.nom.en}*

**${crit.libelle.en}**

${crit.essentiel ? '> **Essential Criterion**: This criterion is marked as essential. A score of 0 will be flagged as a critical finding (KO).\n' : ''}
### Scoring Guide for ${crit.code}

- **Score 0**: No evidence or actions related to this criterion
- **Score 1**: Initial awareness and partial steps taken
- **Score 2**: Substantial implementation with documented evidence
- **Score 3**: Full compliance with comprehensive evidence and regular review

### Recommended Evidence
- Official documents and policies
- Meeting minutes and decisions
- Implementation reports
- Third-party verification (if applicable)

Would you like me to elaborate on any scoring level or suggest specific evidence?`
        }
      }

      return `I'm currently focused on **${dim.code}: ${dim.nom.en}**.

This dimension has ${String(dim.criteres.filter(c => c.actif).length)} active criteria, ${String(dim.criteres.filter(c => c.essentiel && c.actif).length)} of which are essential.

How can I help you with this dimension? I can:
- Explain specific criteria
- Guide you through scoring
- Recommend evidence documents
- Analyze your current assessment status`
    }
  }

  // Generic helpful response
  return `Thank you for your question. As the GSAT Evaluation Assistant, I can help you with:

### Assessment Support
- **Explain dimensions and criteria** from the GSAT V3.0 framework
- **Scoring guidance** with detailed rubrics (0-3 scale)
- **Evidence recommendations** for each criterion
- **Methodology explanations** for the assessment process

### Quick Actions
You can ask me to:
- "Analyze evidence" for your current dimension
- "Explain Dimension 3" (or any dimension D01-D10)
- "Score a 2" to understand what each score level means
- "Methodology FAQ" for general GSAT information

The GSAT V3.0 framework covers **10 dimensions** and **${String(ref.dimensions.flatMap(d => d.criteres.filter(c => c.actif)).length)} active criteria**.

What would you like to explore?`
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function generateAiResponse(
  messages: ChatMessage[],
  dimensionCode: string | null,
  criterionCode: string | null,
): Promise<string> {
  const lastMessage = messages[messages.length - 1]
  if (!lastMessage) throw new Error('No messages provided')

  // Try Edge Function first, fall back to local mock
  try {
    const referentielContext = buildReferentielContext(dimensionCode, criterionCode)
    const { data, error } = await supabase.functions.invoke<ChatWithAiResponse>('chat-with-ai', {
      body: {
        messages: messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content })),
        currentDimension: dimensionCode,
        currentCriterion: criterionCode,
        referentielContext,
      } satisfies ChatWithAiRequest,
    })

    if (error) throw error

    // If Edge Function returned mock (API key not configured),
    // use the richer local mock instead
    if (data?.mock) {
      return generateMockResponse(lastMessage.content, dimensionCode, criterionCode)
    }

    if (!data?.response) throw new Error('Empty response from Edge Function')
    return data.response
  } catch {
    // Edge Function not available — use local mock responses
    // Simulate network delay for realistic UX
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700))
    return generateMockResponse(lastMessage.content, dimensionCode, criterionCode)
  }
}
