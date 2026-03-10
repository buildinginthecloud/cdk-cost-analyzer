import { OptimizationResult, Recommendation } from '../optimization/types';

function filterByMinSavings(
  recommendations: Recommendation[],
  minSavings?: number,
): Recommendation[] {
  if (!minSavings) return recommendations;
  return recommendations.filter(
    (r) => r.estimatedMonthlySavings >= minSavings,
  );
}

function priorityIcon(priority: string): string {
  switch (priority) {
    case 'high':
      return '!!!';
    case 'medium':
      return '!!';
    case 'low':
      return '!';
    default:
      return '';
  }
}

function priorityEmoji(priority: string): string {
  switch (priority) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '';
  }
}

function categoryLabel(category: string): string {
  return category
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatRecommendationsText(
  result: OptimizationResult,
  minSavings?: number,
): string {
  const recs = filterByMinSavings(result.recommendations, minSavings);
  if (recs.length === 0) return '';

  let output = '';
  output += '\n' + '='.repeat(80) + '\n';
  output += 'Cost Optimization Recommendations\n';
  output += '='.repeat(80) + '\n\n';

  output += `Found ${recs.length} optimization${recs.length === 1 ? '' : 's'}`;
  if (result.totalEstimatedMonthlySavings > 0) {
    output += ` | Potential savings: $${result.totalEstimatedMonthlySavings.toFixed(2)}/month ($${(result.totalEstimatedMonthlySavings * 12).toFixed(2)}/year)`;
  }
  output += '\n\n';

  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    output += `-`.repeat(80) + '\n';
    output += `${i + 1}. [${priorityIcon(rec.priority)}] ${rec.title}\n`;
    output += `-`.repeat(80) + '\n';
    output += `   Category: ${categoryLabel(rec.category)}\n`;
    if (rec.estimatedMonthlySavings > 0) {
      output += `   Savings:  ~$${rec.estimatedMonthlySavings.toFixed(2)}/month (${rec.estimatedSavingsPercent}%)\n`;
    }
    output += `   ${rec.description}\n\n`;

    output += '   Action items:\n';
    for (const item of rec.actionItems) {
      output += `     - ${item}\n`;
    }

    if (rec.caveats.length > 0) {
      output += '\n   Caveats:\n';
      for (const caveat of rec.caveats) {
        output += `     * ${caveat}\n`;
      }
    }

    output += '\n';
  }

  output += '='.repeat(80) + '\n';
  output += 'Priority: !!! High  !! Medium  ! Low\n';
  output += '='.repeat(80) + '\n';

  return output;
}

export function formatRecommendationsMarkdown(
  result: OptimizationResult,
  minSavings?: number,
): string {
  const recs = filterByMinSavings(result.recommendations, minSavings);
  if (recs.length === 0) return '';

  let output = '';
  output += '\n## 💡 Cost Optimization Recommendations\n\n';

  if (result.totalEstimatedMonthlySavings > 0) {
    output += `**Total Potential Savings:** $${result.totalEstimatedMonthlySavings.toFixed(2)}/month ($${(result.totalEstimatedMonthlySavings * 12).toFixed(2)}/year)\n\n`;
  }

  // Summary table
  output += '| # | Priority | Recommendation | Est. Savings |\n';
  output += '|---|----------|---------------|-------------|\n';

  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    const savings = rec.estimatedMonthlySavings > 0
      ? `$${rec.estimatedMonthlySavings.toFixed(2)}/mo (${rec.estimatedSavingsPercent}%)`
      : 'Varies';
    output += `| ${i + 1} | ${priorityEmoji(rec.priority)} ${rec.priority} | ${rec.title} | ${savings} |\n`;
  }
  output += '\n';

  // Detailed recommendations in collapsible sections
  output += '<details>\n';
  output += '<summary><strong>View detailed recommendations</strong></summary>\n\n';

  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    output += `### ${i + 1}. ${rec.title}\n\n`;
    output += `**Category:** ${categoryLabel(rec.category)} | `;
    output += `**Priority:** ${priorityEmoji(rec.priority)} ${rec.priority}`;
    if (rec.estimatedMonthlySavings > 0) {
      output += ` | **Savings:** ~$${rec.estimatedMonthlySavings.toFixed(2)}/month`;
    }
    output += '\n\n';
    output += `${rec.description}\n\n`;

    output += '**Action items:**\n';
    for (const item of rec.actionItems) {
      output += `- [ ] ${item}\n`;
    }
    output += '\n';

    if (rec.caveats.length > 0) {
      output += '**Caveats:**\n';
      for (const caveat of rec.caveats) {
        output += `- ${caveat}\n`;
      }
      output += '\n';
    }

    output += `**Affected resources:** ${rec.affectedResources.map((r) => `\`${r}\``).join(', ')}\n\n`;

    if (i < recs.length - 1) {
      output += '---\n\n';
    }
  }

  output += '</details>\n';

  return output;
}
