import { ARIA_ATTRIBUTE_DEFINITIONS } from "./AriaAttributes";
import {
  ARIA_RECOMMENDATION_MODES,
  getAriaRecommendationPolicy,
} from "./AriaRecommendationPolicy";

export const ARIA_RECOMMENDATION_ACTIONS = {
  SET_VALUE: "set-value",
  REMOVE_ATTRIBUTE: "remove-attribute",
  MARK_AS_REVIEWED: "mark-as-reviewed",
};

const CONFIDENCE_LEVELS = ["low", "medium", "high"];

function normalizeAttributeName(attributeName) {
  return typeof attributeName === "string" ? attributeName.toLowerCase() : "";
}

function getDefinition(attributeName) {
  return ARIA_ATTRIBUTE_DEFINITIONS[normalizeAttributeName(attributeName)] || null;
}

export function createAriaRecommendationRequest({
  attributeName,
  currentValue = "",
  context = {},
}) {
  const normalizedAttributeName = normalizeAttributeName(attributeName);
  const definition = getDefinition(normalizedAttributeName);
  const policy = getAriaRecommendationPolicy(normalizedAttributeName);

  if (!definition || !policy) {
    return null;
  }

  return {
    attribute: {
      name: normalizedAttributeName,
      currentValue,
      valueType: definition.valueType,
      finiteValues: definition.finiteValues || [],
    },
    context: policy.context.reduce(
      (selectedContext, field) => {
        selectedContext[field] = context[field];
        return selectedContext;
      },
      { required: policy.context },
    ),
    recommendation: {
      mode: policy.mode,
      question: definition.question,
      allowedActions: Object.values(ARIA_RECOMMENDATION_ACTIONS),
    },
  };
}

// AI output is a recommendation only. The form still validates and applies edits.
export function validateAriaRecommendation(attributeName, recommendation) {
  const definition = getDefinition(attributeName);
  if (!definition || !recommendation || typeof recommendation !== "object") {
    return { valid: false, error: "invalid-recommendation" };
  }

  const { action, confidence, reason, value } = recommendation;
  if (!Object.values(ARIA_RECOMMENDATION_ACTIONS).includes(action)) {
    return { valid: false, error: "invalid-action" };
  }
  if (!CONFIDENCE_LEVELS.includes(confidence)) {
    return { valid: false, error: "invalid-confidence" };
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    return { valid: false, error: "missing-reason" };
  }
  if (action !== ARIA_RECOMMENDATION_ACTIONS.SET_VALUE) {
    return { valid: true, value: null };
  }
  if (
    getAriaRecommendationPolicy(attributeName)?.mode ===
    ARIA_RECOMMENDATION_MODES.REVIEW
  ) {
    return { valid: false, error: "review-only" };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { valid: false, error: "missing-value" };
  }
  if (
    definition.finiteValues &&
    !definition.finiteValues.includes(value)
  ) {
    return { valid: false, error: "invalid-finite-value" };
  }

  return { valid: true, value };
}
