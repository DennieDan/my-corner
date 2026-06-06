declare global {
  interface Window {
    voiceflow: {
      chat: {
        load: (config: Record<string, unknown>) => Promise<void>;
        destroy: () => void;
        open: () => void;
        close: () => void;
        interact: (payload: {
          type: string;
          payload?: Record<string, string>;
        }) => void;
        proactive: {
          push: (message: {
            type: string;
            payload?: Record<string, string>;
          }) => void;
        };
      };
    };
  }
}

export {};
