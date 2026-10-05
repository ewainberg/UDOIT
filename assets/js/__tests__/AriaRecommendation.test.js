import {
  ARIA_RECOMMENDATION_ACTIONS,
  createAriaRecommendationRequest,
  validateAriaRecommendation,
} from "../Services/llmRecs/AriaRecommendation";
import { collectAriaRecommendationContext } from "../Services/llmRecs/AriaRecommendationContext";
import { getAriaRecommendationPolicy } from "../Services/llmRecs/AriaRecommendationPolicy";

describe("ARIA recommendation framework", () => {
  test("constrains finite-value recommendations to the attribute definition", () => {
    const request = createAriaRecommendationRequest({
      attributeName: "aria-expanded",
      currentValue: "maybe",
      context: {
        target: {
          html: '<button aria-expanded="maybe">More</button>',
        },
      },
    });

    expect(request.recommendation.mode).toBe("selection");
    expect(request.attribute.finiteValues).toEqual(["true", "false"]);
    expect(
      validateAriaRecommendation("aria-expanded", {
        action: ARIA_RECOMMENDATION_ACTIONS.SET_VALUE,
        confidence: "high",
        reason: "The button controls visible content.",
        value: "maybe",
      }),
    ).toEqual({ valid: false, error: "invalid-finite-value" });
  });

  test("marks open-ended values as drafts and requests relevant context", () => {
    const request = createAriaRecommendationRequest({
      attributeName: "aria-labelledby",
      context: {
        target: { html: '<input aria-labelledby="field-label">' },
        localMarkup: '<label id="field-label">Email</label>',
        candidateIds: [{ id: "field-label" }],
        ancestors: [],
      },
    });

    expect(request.recommendation.mode).toBe("draft");
    expect(request.context.required).toEqual([
      "target",
      "candidateIds",
      "localMarkup",
      "ancestors",
    ]);
    expect(
      validateAriaRecommendation("aria-labelledby", {
        action: ARIA_RECOMMENDATION_ACTIONS.SET_VALUE,
        confidence: "medium",
        reason: "The visible label names the input.",
        value: "field-label",
      }),
    ).toEqual({ valid: true, value: "field-label" });
  });

  test("collects a minimized ID-reference context from the full content item", () => {
    const context = collectAriaRecommendationContext({
      attributeName: "aria-labelledby",
      activeIssue: {
        xpath: "/html[1]/body[1]/input[1]",
        sourceHtml: '<input aria-labelledby="field-label">',
        status: 0,
      },
      contentHtml:
        '<label id="field-label">Email</label><input aria-labelledby="field-label"><p id="help">Use your school email.</p>',
    });

    expect(context.target.tagName).toBe("input");
    expect(context.candidateIds.map((candidate) => candidate.id)).toEqual([
      "field-label",
      "help",
    ]);
    expect(context.evidence).toContainEqual({
      value: "field-label",
      source: "existing ID on <label>",
    });
    expect(context).not.toHaveProperty("siblings");
  });

  test("requires review instead of a generated value for deprecated attributes", () => {
    expect(getAriaRecommendationPolicy("aria-grabbed").mode).toBe("review");
    expect(
      validateAriaRecommendation("aria-grabbed", {
        action: ARIA_RECOMMENDATION_ACTIONS.SET_VALUE,
        confidence: "high",
        reason: "The item is being dragged.",
        value: "true",
      }),
    ).toEqual({ valid: false, error: "review-only" });
  });

  test("rejects prose in a numeric recommendation", () => {
    expect(
      validateAriaRecommendation("aria-valuenow", {
        action: ARIA_RECOMMENDATION_ACTIONS.SET_VALUE,
        confidence: "medium",
        reason: "A slider needs a number.",
        value: "add a number",
      }),
    ).toEqual({ valid: false, error: "invalid-number-value" });
  });

  test("includes native conflict context without allowing an unrelated action", () => {
    const request = createAriaRecommendationRequest({
      attributeName: "aria-hidden",
      context: {
        target: { html: '<div hidden aria-hidden="false">Details</div>' },
        localMarkup: '<div hidden aria-hidden="false">Details</div>',
        ancestors: [],
        structure: null,
        conflictingHtmlAttribute: "hidden",
      },
      allowedActions: [
        ARIA_RECOMMENDATION_ACTIONS.SET_VALUE,
        ARIA_RECOMMENDATION_ACTIONS.REMOVE_ATTRIBUTE,
        ARIA_RECOMMENDATION_ACTIONS.MARK_AS_REVIEWED,
      ],
    });

    expect(request.context.conflictingHtmlAttribute).toBe("hidden");
    expect(
      validateAriaRecommendation(
        "aria-hidden",
        {
          action: ARIA_RECOMMENDATION_ACTIONS.REMOVE_ATTRIBUTE,
          confidence: "medium",
          reason: "The native hidden attribute already hides this content.",
        },
        [ARIA_RECOMMENDATION_ACTIONS.SET_VALUE],
      ),
    ).toEqual({ valid: false, error: "disallowed-action" });
  });

  test("rejects open-ended text that is not an exact context value", () => {
    const request = createAriaRecommendationRequest({
      attributeName: "aria-label",
      context: {
        target: { html: '<input id="course-title">' },
        localMarkup: '<label for="course-title">Course title</label>',
        ancestors: [],
        evidence: [{ value: "Course title", source: "visible label" }],
      },
    });

    expect(request.attribute.allowedValues).toEqual(["Course title"]);
    expect(
      validateAriaRecommendation(
        "aria-label",
        {
          action: ARIA_RECOMMENDATION_ACTIONS.SET_VALUE,
          confidence: "high",
          reason: "Uses the visible label Course title.",
          value: "Title for this course",
        },
        request.recommendation.allowedActions,
        request.attribute.allowedValues,
      ),
    ).toEqual({ valid: false, error: "not-in-evidence" });
  });

  test("extracts exact numeric tokens from nearby visible text", () => {
    const context = collectAriaRecommendationContext({
      attributeName: "aria-valuenow",
      activeIssue: {
        xpath: "/html[1]/body[1]/section[1]/div[1]",
        sourceHtml: '<div role="slider" aria-valuenow="almost done">65% complete</div>',
        status: 0,
      },
      contentHtml:
        '<section><p>You have completed 65 of 100 activities.</p><div role="slider" aria-valuenow="almost done">65% complete</div></section>',
    });

    expect(context.evidence).toEqual(
      expect.arrayContaining([
        { value: "65", source: "number in nearby visible text" },
        { value: "100", source: "number in nearby visible text" },
      ]),
    );
  });
});
