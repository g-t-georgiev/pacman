/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { PanelId, getPanelConfig } from '../config/ui.config';

export interface PanelTransitionWrapperProps {
  panelId: PanelId;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
}

export const PanelTransitionWrapper: React.FC<PanelTransitionWrapperProps> = ({
  panelId,
  isOpen,
  onClose,
  children,
  className = '',
  backdropClassName = '',
}) => {
  const config = getPanelConfig(panelId);
  const [isMounted, setIsMounted] = useState<boolean>(isOpen);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const exitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      setIsMounted(true);
      setIsExiting(false);
    } else if (isMounted) {
      setIsExiting(true);
      exitTimeoutRef.current = window.setTimeout(() => {
        setIsMounted(false);
        setIsExiting(false);
        exitTimeoutRef.current = null;
      }, config.durationMs);
    }

    return () => {
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [isOpen, config.durationMs, isMounted]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isMounted || !config.closeOnBackdropClick) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMounted, config.closeOnBackdropClick, onClose]);

  if (!isMounted) return null;

  const positionClass =
    config.position === 'top-viewport'
      ? 'panel-pos-top'
      : config.position === 'bottom-viewport'
      ? 'panel-pos-bottom'
      : 'panel-pos-center';

  const animClass = isExiting
    ? `anim-${config.effect}-exit`
    : `anim-${config.effect}-enter`;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && config.closeOnBackdropClick) {
      onClose();
    }
  };

  return (
    <div
      className={`panel-viewport-overlay ${positionClass} ${backdropClassName}`}
      style={{
        backgroundColor: config.backdropColor,
        backdropFilter: config.backdropBlur ? 'blur(6px)' : 'none',
        WebkitBackdropFilter: config.backdropBlur ? 'blur(6px)' : 'none',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`panel-transition-container ${animClass} ${className}`}
        style={
          {
            '--panel-duration': `${config.durationMs}ms`,
            '--panel-easing': config.easing,
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
