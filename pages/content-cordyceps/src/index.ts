import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';

const loader = () => {
  // send message to side panel
  chrome.runtime.sendMessage({
    type: CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
  });
  console.log('Content cordyceps loaded');
};

try {
  loader();
} catch (error) {
  console.log(error);
}
