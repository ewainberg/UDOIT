import React, { useEffect, useRef, useState } from 'react'
import RadioSelector from '../Widgets/RadioSelector'
import { UFIXIT_OPTIONS } from '../../Services/Constants'
import * as Html from '../../Services/Html'
import Api from '../../Services/Api'
import { collectSensoryContext, getSuggestedText, SENSORY_WORDS, validateSensoryRecommendation } from '../../Services/SensoryRecommendation'
// The SensoryMisuseForm.css file is a copy of the tinyMCE oxide skin file, which does not consistently load at runtime, so we include it here
// Failure to do so often results in the TinyMCE editor not display, especially the first time the component is rendered.
import './SensoryMisuseForm.css'

export default function SensoryMisuseForm({
  t, 
  instanceInfo,
  activeContentItem,
  activeIssue, 
  handleIssueSave, 
  addMessage,
  isDisabled,
  handleActiveIssue,
  activeOption,
  setActiveOption,
  formErrors,
  setFormErrors,
  setPreviewData
}) {

  const FORM_OPTIONS = {
    EDIT_TEXT: UFIXIT_OPTIONS.ADD_TEXT,
    MARK_AS_REVIEWED: UFIXIT_OPTIONS.MARK_AS_REVIEWED
  }

  const [editorHtml, setEditorHtml] = useState(Html.getIssueHtml(activeIssue))

  // equal access checks for these words - we can check for them while in tinymce
  // https://github.com/IBMa/equal-access/blob/83eaa932747d1a1156080c60849ff63029d5e293/accessibility-checker-engine/src/v4/rules/text_sensory_misuse.ts
  const sensoryWordRegexes = SENSORY_WORDS.map(word => ({
    word,
    regex: new RegExp(`\\b${word}\\b`, 'i')
  }))

  const excludedTags = ['script', 'style', 'noscript']
  const includedAttributes = ['alt', 'title', 'aria-label']

  const editorRef = useRef(null)
  
  const [sensoryErrors, setSensoryErrors] = useState([])
  const [recommendation, setRecommendation] = useState(null)
  const [recommendationError, setRecommendationError] = useState('')
  const [recommendationLoading, setRecommendationLoading] = useState(false)

  useEffect(() => {
    // if the issue changes, pull new html and set tinymce's html
    if(!activeIssue) {
      return
    }
    
    let html = Html.getIssueHtml(activeIssue)
    setEditorHtml(html);
    setRecommendation(null)
    setRecommendationError('')
    setFormErrors([]);

    const fixed = activeIssue.newHtml && (activeIssue.status === 1 || activeIssue.status === 3);
    const reviewed = activeIssue.newHtml && (activeIssue.status === 2 || activeIssue.status === 3);
    let startingOption = '';

    if (reviewed){
      startingOption = FORM_OPTIONS.MARK_AS_REVIEWED;
    }
    if (fixed) {
      startingOption = FORM_OPTIONS.EDIT_TEXT;
    }

    setActiveOption(startingOption);

    tinymce.remove()
    tinymce.init({
      selector: '#sensory-misuse-textarea',
      license_key: "gpl",
      height: 250,
      menubar: false,
      plugins: "code",
      toolbar: "undo redo | bold italic underline | code",
      // content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
      branding: false,
      skin: "oxide",
      quickbars_insert_toolbar: false,
      statusbar: true,
      setup: (editor) => {
        editor.on('init', () => {
          editor.setContent(html)
          editorRef.current = editor
        })
        editor.on('input', () => {
          handleEditorChange(editor.getContent())
        })
        editor.on('SetContent', () => {
          handleEditorChange(editor.getContent())
        })

        // By default, certain commands like undo/redo and toggling things like bold and italic do not trigger the 'input' event,
        // meaning that the updatePreview function isn't called (which can affect saving).
        editor.on('ExecCommand', (e) => {
          const updateCommands = ['mceToggleFormat', 'undo', 'redo'];
          if(e.command && updateCommands.includes(e.command)) {
            handleEditorChange(editor.getContent());
          }
        })
      }
    })

    return () => {
      tinymce.remove();
    }
  }, [activeIssue])

  useEffect(() => {
    const matchedWords = checkForSensoryWords(editorHtml);
    setSensoryErrors(matchedWords);
    setPreviewData(matchedWords);
  }, [editorHtml])

  const handleEditorChange = (html) => {
    setEditorHtml(html)
    setRecommendation(null)
    updatePreview(html)
  }

  const requestRecommendation = async () => {
    setRecommendationLoading(true)
    setRecommendationError('')
    setRecommendation(null)
    try {
      const response = await new Api(instanceInfo).getSensoryRecommendation(activeIssue.id, {
        html: editorHtml,
        sensoryWords: sensoryErrors,
        context: collectSensoryContext(activeContentItem?.body, activeIssue),
      })
      const result = await response.json()
      if (!response.ok || result.errors?.length || !result.data?.recommendation) {
        throw new Error(result.errors?.[0] || t('form.sensory_misuse.ai.error'))
      }
      const next = result.data.recommendation
      if (!validateSensoryRecommendation(next, editorHtml)) {
        if (next?.action === 'suggest-edit') {
          setRecommendation({
            action: 'manual-review',
            confidence: 'medium',
            reason: t('form.sensory_misuse.ai.manual_review_validation'),
          })
        } else {
          throw new Error(t('form.sensory_misuse.ai.error'))
        }
      } else {
        setRecommendation(next)
      }
    } catch (error) {
      setRecommendationError(error.message || t('form.sensory_misuse.ai.error'))
    } finally {
      setRecommendationLoading(false)
    }
  }

  const applyRecommendation = () => {
    if (recommendation?.action !== 'suggest-edit'
      || !validateSensoryRecommendation(recommendation, editorHtml)) return
    editorRef.current?.setContent(recommendation.html)
    handleEditorChange(recommendation.html)
    setRecommendation(null)
  }

  const approveNoInstructions = () => {
    if (recommendation?.action !== 'no-instructions') return
    setActiveOption(FORM_OPTIONS.MARK_AS_REVIEWED)
    setRecommendation(null)
  }

  const checkForSensoryWords = (html) => {

    const tempFoundWords = new Set()    

    const checkText = (text) => {
      sensoryWordRegexes.forEach(({ word, regex }) => {
        if (regex.test(text)) {
          tempFoundWords.add(word.toLowerCase())
        }
      })
    }

    const traverseNode = (node) => {
      if (node?.nodeType === Node.TEXT_NODE) {
        // Check if the text node contains any sensory words
        checkText(node.textContent);
      }

      if (node?.nodeType === Node.ELEMENT_NODE) {
        // If the element is excluded, skip it
        if (excludedTags.includes(node.tagName.toLowerCase())) {
          return
        }

        // Check attributes for sensory words
        includedAttributes.forEach(attr => {
          if (node?.hasAttribute(attr)) {
            checkText(node.getAttribute(attr));
          }
        })

        // Recursively traverse child nodes
        node?.childNodes?.forEach(child => traverseNode(child));
      }
    }

    let tempDoc = Html.toElement(html)
    traverseNode(tempDoc)
    
    return Array.from(tempFoundWords).sort((a, b) => a < b ? -1 : 1);
  }

  const goToWord = (word) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      editor.focus();

      // we first use xpath to find any text node that contains the sensory word, case insensitively
      // however, this also includes (in the example of "top") words like "laptop", "topic", etc.
      const body = editor.getBody()
      const xpath = `//text()[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${word.toLowerCase()}')]`
      const xpathResults = editor.getDoc().evaluate(
        xpath,
        body,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
      )

      try {
        let result = xpathResults.iterateNext()
        while (result) {
          let text = result.textContent
          // we use regex to further filter the xpath result so we're only matching whole words
          // so "laptop" no longer matches, but "top", "top.", "top;" ... etc. matches
          const wordRegex = new RegExp(`\\b${word}\\b`, 'gi')
          let matches = text.matchAll(wordRegex);

          let tempStart = 0;
          let tempEnd = 0;
          const existingRange = editor.selection.getRng();
          let currentStart = existingRange?.endOffset || Infinity;
          let preferred = false;

          for (const match of matches) {

            if (tempEnd === 0 || (!preferred && match.index > currentStart)) {
              tempStart = match.index;
              tempEnd = match.index + match[0].length;
              if (tempStart > currentStart) {
                preferred = true;
              }
            }
            
          }

          if (tempEnd > 0) {
            const range = editor.getDoc().createRange();
            range.setStart(result, tempStart);
            range.setEnd(result, tempEnd);

            editor.selection.setRng(range);
            editor.selection.scrollIntoView();
          }
          // otherwise, if the regex fails, continue iterating through xpath results
          result = xpathResults.iterateNext()
        }
      }
      catch (e) {
        console.warn(`An error occurred while trying to evaluate the XPath results: ${e}`)
      }
    }
  };

  // This form does NOT have a "Disabled" state: Users can choose to save the text EVEN WHEN there are still
  // potential sensory misuse words in the text. If they choose to save a change, then we ALSO apply the 
  // `udoit-ignore-[rule_id]` class to the element, so that it is ignored in the future.
  const updatePreview = (html) => {
    let element = Html.toElement(html)
    let issue = activeIssue
    const specificClassName = `udoit-ignore-${issue.scanRuleId.replaceAll("_", "-")}`

    let newElement = Html.addClass(issue.sourceHtml, specificClassName)
    newElement.innerHTML = element.innerHTML || html
    issue.newHtml = Html.toString(newElement)

    handleActiveIssue(issue)
  }

  return (
    <>
      {/* OPTION 1: Edit text. ID: "EDIT_TEXT" */}
      <div className={`resolve-option ${activeOption === FORM_OPTIONS.EDIT_TEXT ? 'selected' : ''}`}>
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.EDIT_TEXT}
          labelId = 'edit-text-label'
          labelText = {t('form.sensory_misuse.decision.instructions')}
        />

        <div
          inert={activeOption === FORM_OPTIONS.EDIT_TEXT ? undefined : true}
          className={activeOption === FORM_OPTIONS.EDIT_TEXT ? "" : "hidden"}>
          <div className="instructions mb-3">{t('form.sensory_misuse.label.instructions')}</div>
          { sensoryErrors.length > 0 ? (
            <div className="flex-row flex-wrap gap-1 mb-3">
              <div className="ufixit-widget-label flex-column align-self-center">{t('form.sensory_misuse.label.highlight')}</div>
              {sensoryErrors.map((word) => (
                <button
                  className="tag"
                  tabIndex="0"
                  key={word}
                  onClick={() => goToWord(word)}
                >
                  {word}
                </button>
              ))}
            </div>
          ) : (
            <div className="ufixit-widget-label mb-3">{t('form.sensory_misuse.label.none')}</div>
          )}
          <textarea id="sensory-misuse-textarea"></textarea>
          <div className="mt-2">
            <button type="button" className="btn btn-secondary" onClick={requestRecommendation} disabled={isDisabled || recommendationLoading || sensoryErrors.length === 0}>
              {recommendationLoading ? t('form.sensory_misuse.ai.loading') : t('form.sensory_misuse.ai.request')}
            </button>
            {recommendationError && <p role="alert">{recommendationError}</p>}
            {recommendation && <div className="mt-3" aria-live="polite">
              {recommendation.action === 'suggest-edit' ? <>
                <div className="ufixit-widget-label">{t('form.sensory_misuse.ai.suggested_revision')}</div>
                <p className="mt-1 mb-2">{getSuggestedText(recommendation.html)}</p>
                <p className="mb-2">{recommendation.reason} ({t(`form.sensory_misuse.ai.confidence.${recommendation.confidence}`)})</p>
                <div className="flex-row align-items-center gap-2">
                  <button type="button" className="btn btn-primary" onClick={applyRecommendation}>{t('form.sensory_misuse.ai.apply')}</button>
                  <button type="button" className="btn btn-link" onClick={() => setRecommendation(null)}>{t('form.sensory_misuse.ai.dismiss')}</button>
                </div>
              </> : recommendation.action === 'no-instructions' ? <>
                <div className="ufixit-widget-label">{t('form.sensory_misuse.ai.no_instructions_heading')}</div>
                <p className="mt-1 mb-2">{recommendation.reason} ({t(`form.sensory_misuse.ai.confidence.${recommendation.confidence}`)})</p>
                <div className="flex-row align-items-center gap-2">
                  <button type="button" className="btn btn-primary" onClick={approveNoInstructions}>{t('form.sensory_misuse.ai.no_instructions')}</button>
                  <button type="button" className="btn btn-link" onClick={() => setRecommendation(null)}>{t('form.sensory_misuse.ai.dismiss')}</button>
                </div>
              </> : <>
                <div className="ufixit-widget-label">{t('form.sensory_misuse.ai.manual_review_heading')}</div>
                <p className="mt-1 mb-2">{recommendation.reason}</p>
                <button type="button" className="btn btn-link" onClick={() => setRecommendation(null)}>{t('form.sensory_misuse.ai.dismiss')}</button>
              </>}
            </div>}
          </div>
        </div>
      </div>

      {/* OPTION 2: Mark as Reviewed. ID: "MARK_AS_REVIEWED" */}
      <div className={`resolve-option ${activeOption === FORM_OPTIONS.MARK_AS_REVIEWED ? 'selected' : ''}`}>
        <RadioSelector
          activeOption={activeOption}
          isDisabled={isDisabled}
          setActiveOption={setActiveOption}
          option={FORM_OPTIONS.MARK_AS_REVIEWED}
          labelText = {t('form.sensory_misuse.decision.no_instructions')}
        />
      </div>
    </>
  )
}
