/* reactbits' TextType, as frame-site carries it (with its fix: the
   cursor's endless blink tween is killed on unmount), plus one prop.

   `renderText` hands the typed-so-far string to the caller instead of
   printing it, because on this site the thing that speaks is Emerald's
   own message box, which draws the game's font on a canvas. TextType
   still owns the typing -- the pace, the start-on-visible, the
   sentence callbacks -- and the box only draws what it is given. */

import { type ElementType, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { gsap } from 'gsap';
import './TextType.css';

interface TextTypeProps {
  className?: string;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: string | React.ReactNode;
  cursorBlinkDuration?: number;
  cursorClassName?: string;
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  textColors?: string[];
  variableSpeed?: { min: number; max: number };
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
  renderText?: (typed: string) => React.ReactNode;
}

const TextType = ({
  text,
  as: Component = 'div',
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = '',
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = '|',
  cursorClassName = '',
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
  renderText,
  ...props
}: TextTypeProps & React.HTMLAttributes<HTMLElement>) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLElement>(null);

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return 'inherit';
    return textColors[currentTextIndex % textColors.length];
  };

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  /* The blink, and the kill that was missing.
   *
   *  `repeat: -1` is a tween that never ends, and GSAP's ticker keeps
   *  running it after React has removed the span it writes to — the
   *  element is detached, so nothing is visible and nothing complains.
   *  Onboarding's "Just ask for it" screen remounts this component
   *  deliberately, `key={at}` every 4200ms, so that each phrase types
   *  from empty: somebody who reads that screen for two minutes left
   *  twenty-eight immortal tweens behind, each writing an opacity to a
   *  node in nobody's document, for the rest of the session. */
  useEffect(() => {
    if (!showCursor || renderText || !cursorRef.current) return;
    const el = cursorRef.current;
    gsap.set(el, { opacity: 1 });
    const blink = gsap.to(el, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut'
    });
    return () => {
      blink.kill();
    };
  }, [showCursor, cursorBlinkDuration, renderText]);

  useEffect(() => {
    if (!isVisible) return;

    let timeout: ReturnType<typeof setTimeout>;

    const currentText = textArray[currentTextIndex] ?? '';
    const processedText = reverseMode ? currentText.split('').reverse().join('') : currentText;

    const executeTypingAnimation = () => {
      if (isDeleting) {
        if (displayedText === '') {
          setIsDeleting(false);
          if (currentTextIndex === textArray.length - 1 && !loop) {
            return;
          }

          if (onSentenceComplete) {
            onSentenceComplete(currentText, currentTextIndex);
          }

          setCurrentTextIndex(prev => (prev + 1) % textArray.length);
          setCurrentCharIndex(0);
          timeout = setTimeout(() => {}, pauseDuration);
        } else {
          timeout = setTimeout(() => {
            setDisplayedText(prev => prev.slice(0, -1));
          }, deletingSpeed);
        }
      } else {
        if (currentCharIndex < processedText.length) {
          timeout = setTimeout(
            () => {
              setDisplayedText(prev => prev + processedText[currentCharIndex]);
              setCurrentCharIndex(prev => prev + 1);
            },
            variableSpeed ? getRandomSpeed() : typingSpeed
          );
        } else if (textArray.length >= 1) {
          if (!loop && currentTextIndex === textArray.length - 1) return;
          timeout = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    };

    if (currentCharIndex === 0 && !isDeleting && displayedText === '') {
      timeout = setTimeout(executeTypingAnimation, initialDelay);
    } else {
      executeTypingAnimation();
    }

    return () => clearTimeout(timeout);
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    typingSpeed,
    deletingSpeed,
    pauseDuration,
    textArray,
    currentTextIndex,
    loop,
    initialDelay,
    isVisible,
    reverseMode,
    variableSpeed,
    onSentenceComplete
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping && (currentCharIndex < (textArray[currentTextIndex]?.length ?? 0) || isDeleting);

  /* JSX rather than `createElement`.
 
     `react-hooks/refs` flags handing a ref object to a function call,
     because a function may read `.current` during render and a ref's
     value is not render data. `createElement` is such a call. The JSX
     form attaches the ref the way React expects, with the same dynamic
     tag, and is the same output. */
  const Tag = Component as ElementType

  return (
    <Tag ref={containerRef} className={`text-type ${className}`} {...props}>
      {renderText ? renderText(displayedText) : (
        <span className="text-type__content" style={{ color: getCurrentTextColor() || 'inherit' }}>
          {displayedText}
        </span>
      )}
      {showCursor && !renderText && (
        <span
          ref={cursorRef}
          className={`text-type__cursor ${cursorClassName} ${shouldHideCursor ? 'text-type__cursor--hidden' : ''}`}
        >
          {cursorCharacter}
        </span>
      )}
    </Tag>
  );
};

export default TextType;
