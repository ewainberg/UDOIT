import React, { useEffect, useState } from "react";
import RadioSelector from "../Widgets/RadioSelector";
import OptionFeedback from "../Widgets/OptionFeedback";
import Combobox from "../Widgets/Combobox";
import * as Html from "../../Services/Html";
import { UFIXIT_OPTIONS } from "../../Services/Constants";
import { ARIA_ATTRIBUTE_DEFINITIONS } from "../../Services/AriaAttributes";
import {
  createAriaRecommendationRequest,
  validateAriaRecommendation,
} from "../../Services/AriaRecommendation";
import { collectAriaRecommendationContext } from "../../Services/AriaRecommendationContext";
import Api from "../../Services/Api";

const REMOVAL_ONLY_RULES = new Set([
  "aria_attribute_allowed",
  "aria_attribute_conflict",
  "aria_attribute_redundant",
]);

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
  const [attributeValue, setAttributeValue] = useState("");
  const [valueOptions, setValueOptions] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);

  useEffect(() => {
    if (!activeIssue) {
      return;
    }

    const html = Html.getIssueHtml(activeIssue);
    const element = Html.toElement(html);
    const metadata = activeIssue.metadata
      ? JSON.parse(activeIssue.metadata)
      : {};
    const metadataAttribute = metadata.messageArgs?.find((value) =>
      /^aria-/i.test(value),
    );
    const ariaAttributes = Html.getAriaAttributes(html);
    const detectedAttribute = metadataAttribute || ariaAttributes[0] || "";
    const currentValue = detectedAttribute
      ? Html.getAttribute(element, detectedAttribute) || ""
      : "";
    const validValues =
      ARIA_ATTRIBUTE_DEFINITIONS[detectedAttribute]?.finiteValues || [];

    setAttributeName(detectedAttribute);
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
  }, [activeIssue]);

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
    if (REMOVAL_ONLY_RULES.has(activeIssue?.scanRuleId)) {
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
    const recommendationRequest = createAriaRecommendationRequest({
      attributeName,
      currentValue: attributeValue,
      context,
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
      const responseBody = await response.json();
      const result = validateAriaRecommendation(
        attributeName,
        responseBody?.data?.recommendation,
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
          isDisabled={isDisabled || !attributeName}
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
