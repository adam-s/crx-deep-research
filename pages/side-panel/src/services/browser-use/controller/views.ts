/**
 * TypeScript implementation of browser-use controller views
 */

// Action Input Models
export class SearchGoogleAction {
  query: string = '';

  static schema() {
    return {
      properties: {
        query: { type: 'string' },
      },
    };
  }
}

export class GoToUrlAction {
  url: string = '';

  static schema() {
    return {
      properties: {
        url: { type: 'string' },
      },
    };
  }
}

export class ClickElementAction {
  index: number = 0;
  xpath?: string;

  static schema() {
    return {
      properties: {
        index: { type: 'integer' },
        xpath: { type: 'string', optional: true },
      },
    };
  }
}

export class InputTextAction {
  index: number = 0;
  text: string = '';
  xpath?: string;

  static schema() {
    return {
      properties: {
        index: { type: 'integer' },
        text: { type: 'string' },
        xpath: { type: 'string', optional: true },
      },
    };
  }
}

/**
 * Action to complete a task
 */
// Direct port of Python's DoneAction class
// In Python: class DoneAction(BaseModel):
//   text: str
//   success: bool
export class DoneAction {
  text: string;
  success: boolean;

  constructor(params: { text: string; success: boolean }) {
    this.text = params.text;
    this.success = params.success;
  }

  static schema() {
    return {
      properties: {
        text: { type: 'string' },
        success: { type: 'boolean' },
      },
    };
  }
}

export class SwitchTabAction {
  pageId: number = 0;

  static schema() {
    return {
      properties: {
        pageId: { type: 'integer' },
      },
    };
  }
}

export class OpenTabAction {
  url: string = '';

  static schema() {
    return {
      properties: {
        url: { type: 'string' },
      },
    };
  }
}

export class ScrollAction {
  amount?: number;

  static schema() {
    return {
      properties: {
        amount: { type: 'integer', optional: true },
      },
    };
  }
}

export class SendKeysAction {
  keys: string = '';

  static schema() {
    return {
      properties: {
        keys: { type: 'string' },
      },
    };
  }
}

export class ExtractPageContentAction {
  value: string = '';

  static schema() {
    return {
      properties: {
        value: { type: 'string' },
      },
    };
  }
}

/**
 * Accepts absolutely anything in the incoming data
 * and discards it, so the final parsed model is empty.
 */
export class NoParamsAction {
  constructor(_?: any) {
    // Ignore all inputs
    // This is equivalent to Python's @model_validator(mode='before')
    // def ignore_all_inputs(cls, values):
    //   # No matter what the user sends, discard it and return empty.
    //   return {}
  }

  static schema() {
    return {
      properties: {},
    };
  }
}

/**
 * Action to select an option from a dropdown by text
 */
export class SelectDropdownOptionAction {
  index: number = 0;
  text: string = '';

  static schema() {
    return {
      properties: {
        index: { type: 'integer' },
        text: { type: 'string' },
      },
    };
  }
}

/**
 * Action to wait for a specified number of seconds
 */
export class WaitAction {
  seconds: number = 3;

  static schema() {
    return {
      properties: {
        seconds: { type: 'integer', optional: true },
      },
    };
  }
}

/**
 * Action to scroll to text on the page
 */
export class ScrollToTextAction {
  text: string = '';

  static schema() {
    return {
      properties: {
        text: { type: 'string' },
      },
    };
  }
}

/**
 * Action to get dropdown options
 */
export class GetDropdownOptionsAction {
  index: number = 0;

  static schema() {
    return {
      properties: {
        index: { type: 'integer' },
      },
    };
  }
}
