const finiteValues = (values, questionKey) => ({
  type: "finite",
  values,
  questionKey,
  answerKey: "form.aria_attribute.answer.choose",
});

const integer = (questionKey) => ({
  type: "integer",
  questionKey,
  answerKey: "form.aria_attribute.answer.integer",
});

const number = (questionKey) => ({
  type: "number",
  questionKey,
  answerKey: "form.aria_attribute.answer.number",
});

const tokenList = (values, questionKey) => ({
  type: "token-list",
  values,
  questionKey,
  answerKey: "form.aria_attribute.answer.tokens",
});

export const ARIA_ATTRIBUTE_DEFINITIONS = {
  "aria-atomic": finiteValues(["true", "false"], "form.aria_attribute.question.atomic"),
  "aria-autocomplete": finiteValues(["none", "inline", "list", "both"], "form.aria_attribute.question.autocomplete"),
  "aria-busy": finiteValues(["true", "false"], "form.aria_attribute.question.busy"),
  "aria-checked": finiteValues(["true", "false", "mixed"], "form.aria_attribute.question.checked"),
  "aria-colcount": integer("form.aria_attribute.question.column_count"),
  "aria-colindex": integer("form.aria_attribute.question.column_position"),
  "aria-colspan": integer("form.aria_attribute.question.column_span"),
  "aria-current": finiteValues(["false", "page", "step", "location", "date", "time", "true"], "form.aria_attribute.question.current"),
  "aria-disabled": finiteValues(["true", "false"], "form.aria_attribute.question.disabled"),
  "aria-expanded": finiteValues(["true", "false"], "form.aria_attribute.question.expanded"),
  "aria-haspopup": finiteValues(["false", "true", "menu", "listbox", "tree", "grid", "dialog"], "form.aria_attribute.question.popup"),
  "aria-hidden": finiteValues(["true", "false"], "form.aria_attribute.question.hidden"),
  "aria-invalid": finiteValues(["false", "true", "grammar", "spelling"], "form.aria_attribute.question.invalid"),
  "aria-level": integer("form.aria_attribute.question.level"),
  "aria-live": finiteValues(["off", "polite", "assertive"], "form.aria_attribute.question.live"),
  "aria-modal": finiteValues(["true", "false"], "form.aria_attribute.question.modal"),
  "aria-multiline": finiteValues(["true", "false"], "form.aria_attribute.question.multiline"),
  "aria-multiselectable": finiteValues(["true", "false"], "form.aria_attribute.question.multiselectable"),
  "aria-orientation": finiteValues(["horizontal", "vertical"], "form.aria_attribute.question.orientation"),
  "aria-posinset": integer("form.aria_attribute.question.set_position"),
  "aria-pressed": finiteValues(["true", "false", "mixed"], "form.aria_attribute.question.pressed"),
  "aria-readonly": finiteValues(["true", "false"], "form.aria_attribute.question.readonly"),
  "aria-relevant": tokenList(["additions", "removals", "text", "all"], "form.aria_attribute.question.relevant"),
  "aria-required": finiteValues(["true", "false"], "form.aria_attribute.question.required"),
  "aria-rowcount": integer("form.aria_attribute.question.row_count"),
  "aria-rowindex": integer("form.aria_attribute.question.row_position"),
  "aria-rowspan": integer("form.aria_attribute.question.row_span"),
  "aria-selected": finiteValues(["true", "false"], "form.aria_attribute.question.selected"),
  "aria-setsize": integer("form.aria_attribute.question.set_size"),
  "aria-sort": finiteValues(["ascending", "descending", "none", "other"], "form.aria_attribute.question.sort"),
  "aria-valuemax": number("form.aria_attribute.question.maximum"),
  "aria-valuemin": number("form.aria_attribute.question.minimum"),
  "aria-valuenow": number("form.aria_attribute.question.current_value"),
};

const RULE_DECISIONS = {
  aria_attribute_allowed: "remove",
  aria_attribute_deprecated: "remove",
  aria_attribute_redundant: "remove",
  aria_attribute_conflict: "conflict",
  aria_attribute_exists: "empty",
  aria_attribute_required: "required",
};

export function getReportedAriaAttributes(issue) {
  try {
    const values = JSON.parse(issue?.metadata || "{}").messageArgs || [];
    return [...new Set(values.flatMap((value) =>
      typeof value === "string" ? value.match(/aria-[a-z0-9-]+/gi) || [] : [],
    ))];
  } catch {
    return [];
  }
}

export function getAriaAttributeDecision(issue, attributeName) {
  const selectedAttribute = attributeName || issue?.selectedAriaAttribute || getReportedAriaAttributes(issue)[0] || "";
  const ruleDecision = RULE_DECISIONS[issue?.scanRuleId];
  const definition = ARIA_ATTRIBUTE_DEFINITIONS[selectedAttribute];

  if (ruleDecision) {
    return {
      attributeName: selectedAttribute,
      questionKey: `form.aria_attribute.rule.${ruleDecision}`,
      answerKey: ruleDecision === "remove"
        ? "form.aria_attribute.label.remove"
        : definition?.answerKey || "form.aria_attribute.answer.text",
    };
  }

  return {
    attributeName: selectedAttribute,
    questionKey: definition?.questionKey || "form.aria_attribute.question.generic",
    answerKey: definition?.answerKey || "form.aria_attribute.answer.text",
  };
}
