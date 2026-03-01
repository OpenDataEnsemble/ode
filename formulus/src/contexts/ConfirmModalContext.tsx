/**
 * ConfirmModalContext – provides showConfirm() to display a card-style
 * confirmation modal (replacing Alert.alert for confirmations) across the app.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import ConfirmModal, { ConfirmButton } from '../components/common/ConfirmModal';

interface ConfirmOptions {
  title: string;
  message: string;
  buttons: ConfirmButton[];
}

interface ConfirmModalContextValue {
  showConfirm: (options: ConfirmOptions) => void;
  hideConfirm: () => void;
}

const ConfirmModalContext = createContext<ConfirmModalContextValue | undefined>(
  undefined,
);

export function ConfirmModalProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<ConfirmButton[]>([]);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setTitle(options.title);
    setMessage(options.message);
    setButtons(options.buttons);
    setVisible(true);
  }, []);

  const hideConfirm = useCallback(() => {
    setVisible(false);
    setTitle('');
    setMessage('');
    setButtons([]);
  }, []);

  const value = useMemo(
    () => ({ showConfirm, hideConfirm }),
    [showConfirm, hideConfirm],
  );

  return (
    <ConfirmModalContext.Provider value={value}>
      {children}
      <ConfirmModal
        visible={visible}
        title={title}
        message={message}
        buttons={buttons}
        onRequestClose={hideConfirm}
      />
    </ConfirmModalContext.Provider>
  );
}

export function useConfirmModal(): ConfirmModalContextValue {
  const ctx = useContext(ConfirmModalContext);
  if (ctx === undefined) {
    throw new Error(
      'useConfirmModal must be used within a ConfirmModalProvider',
    );
  }
  return ctx;
}
