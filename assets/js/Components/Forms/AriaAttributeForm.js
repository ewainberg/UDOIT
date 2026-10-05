import React, { useEffect, useState } from "react";
import RadioSelector from "../Widgets/RadioSelector";
import OptionFeedback from "../Widgets/OptionFeedback";
import Combobox from "../Widgets/Combobox";
import * as Html from "../../Services/Html";
import { UFIXIT_OPTIONS } from "../../Services/Constants";
import { ARIA_ATTRIBUTE_DEFINITIONS } from "../../Services/llmRecs/AriaAttributes";
import {
  ARIA_RECOMMENDATION_ACTIONS,
  createAriaRecommendationRequest,
  validateAriaRecommendation,
} from "../../Services/llmRecs/AriaRecommendation";
import { collectAriaRecommendationContext } from "../../Services/llmRecs/AriaRecommendationContext";
import Api from "../../Services/Api";

const REMOVAL_ONLY_RULES = new Set([
  "aria_attribute_allowed",
  "aria_attribute_redundant",
  "aria_attribute_deprecated",
]);

const CONFLICT_RULES = new Set(["aria_attribute_conflict"]);

function getIssueMetadata(activeIssue) {
  try {
    return activeIssue.metadata ? JSON.parse(activeIssue.metadata) : {};
  } catch {
    return {};
  }
}

function getReportedAriaAttributes(activeIssue) {
  const metadata = getIssueMetadata(activeIssue);
  const messageValues = Array.isArray(metadata.messageArgs)
    ? metadata.messageArgs
    : [];
  const reportedAttributes = messageValues.flatMap((value) =>
    typeof value === "string" ? value.match(/aria-[a-z0-9-]+/gi) || [] : [],
  );

  return [...new Set(reportedAttributes)];
}

function getConflictHtmlAttribute(activeIssue) {
  if (activeIssue.scanRuleId !== "aria_attribute_conflict") {
    return "";
  }

  const metadata = getIssueMetadata(activeIssue);
  return (metadata.messageArgs || []).find(
    (value) => typeof value === "string" && !/^aria-/i.test(value),
  ) || "";
}

export default function AriaAttributeForm({
  t,
  activeIssue,
  isDisabled,
  handleActiveIssue,
  activeOption,
  setActiveOption,
  formErrors,
  setFormErrors,
  activeContentItem,
  instanceInfo,
}) {
  const FORM_OPTIONS = {
    SELECT_VALUE: UFIXIT_OPTIONS.SELECT_ATTRIBUTE_VALUE,
    DELETE_ATTRIBUTE: UFIXIT_OPTIONS.DELETE_ATTRIBUTE,
    MARK_AS_REVIEWED: UFIXIT_OPTIONS.MARK_AS_REVIEWED,
  };

  const [attributeName, setAttributeName] = useState("");
  const [attributeNames, setAttributeNames] = useState([]);
  const [attributeValue, setAttributeValue] = useState("");
  const [valueOptions, setValueOptions] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);

  useEffect(() => {
    if (!activeIssue) {
      return;
    }

    const reportedAttributes = getReportedAriaAttributes(activeIssue);
    const detectedAttribute = reportedAttributes[0] || "";

    setAttributeNames(reportedAttributes);
    setAttributeName(detectedAttribute);
    setRecommendation(null);
    setRecommendationError("");
  }, [activeIssue]);

  useEffect(() => {
    if (!activeIssue || !attributeName) {
      return;
    }

    const element = Html.toElement(Html.getIssueHtml(activeIssue));
    const currentValue = attributeName
      ? Html.getAttribute(element, attributeName) || ""
      : "";
    const validValues =
      ARIA_ATTRIBUTE_DEFINITIONS[attributeName]?.finiteValues || [];

    setAttributeValue(currentValue);
    setRecommendation(null);
    setRecommendationError("");
    setValueOptions(
      validValues.map((value) => ({
        value,
        name: value,
        selected: value === currentValue,
      })),
    );

    const fixed =
      activeIssue.newHtml &&
      (activeIssue.status === 1 || activeIssue.status === 3);
    const reviewed =
      activeIssue.newHtml &&
      (activeIssue.status === 2 || activeIssue.status === 3);
    if (reviewed) {
      setActiveOption(FORM_OPTIONS.MARK_AS_REVIEWED);
    } else if (fixed && currentValue && validValues.includes(currentValue)) {
      setActiveOption(FORM_OPTIONS.SELECT_VALUE);
    } else if (fixed && !element) {
      setActiveOption(FORM_OPTIONS.DELETE_ATTRIBUTE);
    } else {
      setActiveOption("");
    }
  }, [activeIssue, attributeName]);

  useEffect(() => {
    updateHtmlContent();
    checkFormErrors();
  }, [activeOption, attributeValue]);

  const updateHtmlContent = () => {
    const issue = activeIssue;
    if (!issue) {
      return;
    }

    if (activeOption === FORM_OPTIONS.MARK_AS_REVIEWED) {
      issue.newHtml = issue.initialHtml;
      handleActiveIssue(issue);
      return;
    }

    const element = Html.toElement(Html.getIssueHtml(activeIssue));
    if (!element || !attributeName) {
      issue.newHtml = issue.initialHtml;
      handleActiveIssue(issue);
      return;
    }

    const updatedElement =
      activeOption === FORM_OPTIONS.DELETE_ATTRIBUTE
        ? Html.removeAttribute(element, attributeName)
        : Html.setAttribute(element, attributeName, attributeValue);

    issue.newHtml = Html.toString(updatedElement);
    handleActiveIssue(issue);
  };

  const checkFormErrors = () => {
    const tempErrors = {
      [FORM_OPTIONS.SELECT_VALUE]: [],
      [FORM_OPTIONS.DELETE_ATTRIBUTE]: [],
    };

    if (activeOption === FORM_OPTIONS.SELECT_VALUE) {
      if (!attributeName || !attributeValue) {
        tempErrors[FORM_OPTIONS.SELECT_VALUE].push({
          text: t("form.aria_attribute.msg.attribute_required"),
          type: "error",
        });
      } else if (
        valueOptions.length > 0 &&
        !valueOptions.some((option) => option.value === attributeValue)
      ) {
        tempErrors[FORM_OPTIONS.SELECT_VALUE].push({
          text: t("form.aria_attribute.msg.attribute_required"),
          type: "error",
        });
      } else if (
        ARIA_ATTRIBUTE_DEFINITIONS[attributeName]?.valueType === "integer" &&
        !/^-?\d+$/.test(attributeValue.trim())
      ) {
        tempErrors[FORM_OPTIONS.SELECT_VALUE].push({
          text: t("form.aria_attribute.msg.attribute_required"),
          type: "error",
        });
      } else if (
        ARIA_ATTRIBUTE_DEFINITIONS[attributeName]?.valueType === "number" &&
        !Number.isFinite(Number(attributeValue.trim()))
      ) {
        tempErrors[FORM_OPTIONS.SELECT_VALUE].push({
          text: t("form.aria_attribute.msg.attribute_required"),
          type: "error",
        });
      }
    }

    setFormErrors(tempErrors);
  };

  const handleValueChange = (id, value) => {
    setAttributeValue(value);
    setValueOptions((options) =>
      options.map((option) => ({
        ...option,
        selected: option.value === value,
      })),
    );
  };

  const requestRecommendation = async () => {
    const removalOnly = REMOVAL_ONLY_RULES.has(activeIssue?.scanRuleId);
    const conflict = CONFLICT_RULES.has(activeIssue?.scanRuleId);
    if (removalOnly) {
      setRecommendation({
        action: "remove-attribute",
        confidence: "high",
        reason: t("form.aria_attribute.ai.remove_required"),
      });
      setRecommendationError("");
      return;
    }

    if (!attributeName || !activeIssue?.id || !activeContentItem?.body) {
      setRecommendationError(t("form.aria_attribute.ai.error"));
      return;
    }

    const context = collectAriaRecommendationContext({
      attributeName,
      activeIssue,
      contentHtml: activeContentItem.body,
    });
    if (!context) {
      setRecommendationError(t("form.aria_attribute.ai.error"));
      return;
    }
    const definition = ARIA_ATTRIBUTE_DEFINITIONS[attributeName];
    const requiresEvidence = definition && !definition.finiteValues;
    const canRecommendValue =
      !requiresEvidence || (context.evidence || []).length > 0;
    const allowedActions = conflict
      ? [
          ...(canRecommendValue
            ? [ARIA_RECOMMENDATION_ACTIONS.SET_VALUE]
            : []),
          ARIA_RECOMMENDATION_ACTIONS.REMOVE_ATTRIBUTE,
          ARIA_RECOMMENDATION_ACTIONS.MARK_AS_REVIEWED,
        ]
      : [
          ...(canRecommendValue
            ? [ARIA_RECOMMENDATION_ACTIONS.SET_VALUE]
            : []),
          ARIA_RECOMMENDATION_ACTIONS.MARK_AS_REVIEWED,
        ];
    const recommendationRequest = createAriaRecommendationRequest({
      attributeName,
      currentValue: attributeValue,
      context: {
        ...context,
        conflictingHtmlAttribute: conflict
          ? getConflictHtmlAttribute(activeIssue)
          : undefined,
      },
      allowedActions,
    });
    if (!recommendationRequest) {
      setRecommendationError(t("form.aria_attribute.ai.error"));
      return;
    }

    setIsRecommendationLoading(true);
    setRecommendation(null);
    setRecommendationError("");
    try {
      const response = await new Api(instanceInfo).getAriaRecommendation(
        activeIssue.id,
        recommendationRequest,
      );
      const responseText = await response.text();
      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        throw new Error(t("form.aria_attribute.ai.error"));
      }
      const result = validateAriaRecommendation(
        attributeName,
        responseBody?.data?.recommendation,
        recommendationRequest.recommendation.allowedActions,
        recommendationRequest.attribute.allowedValues,
      );
      if (!response.ok || !result.valid) {
        throw new Error(
          responseBody?.errors?.[0] || "Invalid recommendation response",
        );
      }
      setRecommendation(responseBody.data.recommendation);
    } catch (error) {
      setRecommendationError(
        error.message || t("form.aria_attribute.ai.error"),
      );
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const recommendationLabel = () => {
    if (recommendation.action === "set-value") {
      return t("form.aria_attribute.ai.set_value", {
        attributeName,
        value: recommendation.value,
      });
    }
    if (recommendation.action === "remove-attribute") {
      return t("form.aria_attribute.ai.remove");
    }
    return t("form.aria_attribute.ai.review");
  };

  const canSelectValue =
    Boolean(ARIA_ATTRIBUTE_DEFINITIONS[attributeName]) &&
    !REMOVAL_ONLY_RULES.has(activeIssue?.scanRuleId);
  const canRemoveAttribute =
    REMOVAL_ONLY_RULES.has(activeIssue?.scanRuleId) ||
    CONFLICT_RULES.has(activeIssue?.scanRuleId);

  const approveRecommendation = () => {
    if (recommendation.action === "set-value") {
      handleValueChange(null, recommendation.value);
      setActiveOption(FORM_OPTIONS.SELECT_VALUE);
    } else if (recommendation.action === "remove-attribute") {
      setActiveOption(FORM_OPTIONS.DELETE_ATTRIBUTE);
    } else {
      setActiveOption(FORM_OPTIONS.MARK_AS_REVIEWED);
    }
    setRecommendation(null);
  };

  return (
    <>
      <div className="mb-2">
        {attributeNames.length > 1 && (
          <label>
            {t("form.aria_attribute.name")}
            <select
              className="w-100"
              disabled={isDisabled}
              value={attributeName}
              onChange={(event) => setAttributeName(event.target.value)}
            >
              {attributeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="btn btn-secondary"
          type="button"
          disabled={
            isDisabled ||
            isRecommendationLoading ||
            !attributeName ||
            (!activeContentItem?.body &&
              !REMOVAL_ONLY_RULES.has(activeIssue?.scanRuleId))
          }
          onClick={requestRecommendation}
        >
          {isRecommendationLoading
            ? t("form.aria_attribute.ai.loading")
            : t("form.aria_attribute.ai.button")}
        </button>
        {recommendation && (
          <div className="mt-1" role="status">
            <strong>{recommendationLabel()}</strong>
            <div>{recommendation.reason}</div>
            <div className="mt-1 flex-row gap-1">
              <button
                className="btn btn-primary"
                type="button"
                disabled={isDisabled}
                onClick={approveRecommendation}
              >
                {t("form.aria_attribute.ai.approve")}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={isDisabled}
                onClick={() => setRecommendation(null)}
              >
                {t("form.aria_attribute.ai.deny")}
              </button>
            </div>
          </div>
        )}
        {recommendationError && (
          <div className="mt-1 udoit-error" role="alert">
            {recommendationError}
          </div>
        )}
      </div>

      <div
        className={`resolve-option ${activeOption === FORM_OPTIONS.SELECT_VALUE ? "selected" : ""}`}
      >
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled || !attributeName || !canSelectValue}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.SELECT_VALUE}
          labelId="aria-attribute-value-label"
          labelText={t("form.aria_attribute.label.select")}
        />
        {activeOption === FORM_OPTIONS.SELECT_VALUE && (
          <>
            {valueOptions.length > 0 ? (
              <Combobox
                handleChange={handleValueChange}
                id="aria-attribute-value"
                isDisabled={isDisabled}
                label=""
                options={valueOptions}
              />
            ) : (
              <input
                aria-labelledby="aria-attribute-value-label"
                className="w-100"
                type="text"
                value={attributeValue}
                onChange={(event) => setAttributeValue(event.target.value)}
                disabled={isDisabled}
              />
            )}
            <OptionFeedback
              t={t}
              feedbackArray={formErrors[FORM_OPTIONS.SELECT_VALUE]}
            />
          </>
        )}
      </div>

      <div
        className={`resolve-option ${activeOption === FORM_OPTIONS.DELETE_ATTRIBUTE ? "selected" : ""}`}
      >
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled || !attributeName || !canRemoveAttribute}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.DELETE_ATTRIBUTE}
          labelText={t("form.aria_attribute.label.remove")}
        />
      </div>

      <div
        className={`resolve-option ${activeOption === FORM_OPTIONS.MARK_AS_REVIEWED ? "selected" : ""}`}
      >
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.MARK_AS_REVIEWED}
          labelText={t("fix.label.no_changes")}
        />
      </div>
    </>
  );
}
