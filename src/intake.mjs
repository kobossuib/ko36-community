export function initialLabels(labels, action) {
  if (!['opened', 'reopened'].includes(action)) return labels;
  const next = [...new Set(labels.filter(label => !label.startsWith('status:')))];
  next.push('status:incoming');
  if (!next.some(label => label.startsWith('source:'))) next.push('source:github');
  return next;
}
