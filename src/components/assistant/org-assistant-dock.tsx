'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useConvexAuth } from 'convex/react';
import { useAction, useMutation, useQuery } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { useBranding } from '@/hooks/use-branding';
import { Button } from '@/components/ui/button';
import {
  AssistantInput,
  type AssistantInputHandle,
  type MentionRef,
} from './assistant-input';
import { BarsSpinner } from '@/components/bars-spinner';
import { cn } from '@/lib/utils';
import { ArrowUp, ChevronsDown, ChevronsUp, Trash2, X } from 'lucide-react';
import {
  type UIMessage,
  optimisticallySendMessage,
  useUIMessages,
} from '@convex-dev/agent/react';
import { resolveAssistantPageContext } from '@/lib/assistant-context';
import { useAssistantActions } from '@/hooks/use-assistant-actions';
import { useConfirm } from '@/hooks/use-confirm';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AssistantDockMessage } from './assistant-message-renderer';

type PendingAction = {
  id: string;
  entityType: 'document' | 'issue' | 'project' | 'team';
  entityLabel: string;
  summary: string;
};

const CHAT_PANEL_TRANSITION = {
  height: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 30,
    mass: 0.9,
  },
  opacity: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
};
const CHAT_PANEL_EXIT = {
  height: { duration: 0.16, ease: [0.4, 0, 1, 1] as const },
  opacity: { duration: 0.12, ease: [0.4, 0, 1, 1] as const },
};

export function OrgAssistantDock({ orgSlug }: { orgSlug: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const branding = useBranding();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useAssistantActions(orgSlug);
  const pageContext = useMemo(
    () =>
      resolveAssistantPageContext({
        orgSlug,
        pathname,
        searchParams,
      }),
    [orgSlug, pathname, searchParams],
  );
  const isReadyForAssistant = isAuthenticated && !isLoading;

  const threadRowQuery = useQuery(
    api.ai.queries.getThreadForCurrentUser,
    isReadyForAssistant ? { orgSlug } : 'skip',
  );
  const threadRow = threadRowQuery.data;
  const pendingThreadIdRef = useRef<string | null>(null);
  const ensureThread = useMutation(api.ai.mutations.ensureThread);
  const sendMessage = useMutation(
    api.ai.mutations.sendMessage,
  ).withOptimisticUpdate((store, args) => {
    const optimisticThreadId =
      threadRowQuery.data?.threadId ?? pendingThreadIdRef.current;
    if (!optimisticThreadId) return;
    optimisticallySendMessage(api.ai.queries.listThreadMessages)(store, {
      threadId: optimisticThreadId,
      prompt: args.prompt,
    });
  });
  const executeConfirmedAction = useMutation(
    api.ai.mutations.executeConfirmedAction,
  );
  const cancelPendingAction = useMutation(api.ai.mutations.cancelPendingAction);
  const clearThreadHistory = useAction(api.ai.actions.clearThreadHistory);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmAction, ConfirmActionDialog] = useConfirm();
  const inputRef = useRef<AssistantInputHandle>(null);

  const threadId = threadRow?.threadId;
  const uiMessages = useUIMessages(
    api.ai.queries.listThreadMessages,
    isReadyForAssistant && threadId ? { threadId } : 'skip',
    {
      initialNumItems: 20,
      stream: true,
    },
  );

  const messages = useMemo(
    () => (uiMessages.results ?? []) as UIMessage[],
    [uiMessages.results],
  );
  const pendingAction = (threadRow?.pendingAction ??
    null) as PendingAction | null;
  const hasMessages = messages.length > 0;
  const isAssistantActive =
    isSending ||
    threadRow?.threadStatus === 'pending' ||
    messages.some(message => message.status === 'streaming');

  // --- Scroll management ---
  const contentRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScrollTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const prevMessageCountRef = useRef(0);
  const needsInitialScrollRef = useRef(true);
  const shouldAutoFollowRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);

  const getViewport = useCallback((): HTMLElement | null => {
    if (viewportRef.current) {
      return viewportRef.current;
    }
    const base = contentRef.current ?? endRef.current;
    if (!base) return null;
    return base.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
  }, []);

  const isNearBottom = useCallback((element: HTMLElement, threshold = 40) => {
    return (
      element.scrollHeight - element.scrollTop - element.clientHeight <=
      threshold
    );
  }, []);

  const markProgrammaticScroll = useCallback(() => {
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      programmaticScrollTimeoutRef.current = null;
    }, 140);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const viewport = getViewport();
      if (!viewport) {
        endRef.current?.scrollIntoView({ behavior, block: 'end' });
        return;
      }

      const userMessages =
        contentRef.current?.querySelectorAll<HTMLElement>(
          '[data-message-role="user"]',
        ) ?? [];
      const latestUserMessage =
        userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;

      if (latestUserMessage) {
        markProgrammaticScroll();
        const viewportRect = viewport.getBoundingClientRect();
        const messageRect = latestUserMessage.getBoundingClientRect();
        const messageTopInScroll =
          messageRect.top - viewportRect.top + viewport.scrollTop;
        const targetTop = Math.max(
          0,
          Math.min(
            messageTopInScroll - viewport.clientHeight * 0.28,
            viewport.scrollHeight - viewport.clientHeight,
          ),
        );
        if (behavior === 'auto') {
          viewport.scrollTop = targetTop;
        } else {
          viewport.scrollTo({ top: targetTop, behavior });
        }
      } else if (behavior === 'auto') {
        markProgrammaticScroll();
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        endRef.current?.scrollIntoView({ behavior, block: 'end' });
      }
    },
    [getViewport, markProgrammaticScroll],
  );

  const scrollToTail = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const viewport = getViewport();
      if (!viewport) {
        endRef.current?.scrollIntoView({ behavior, block: 'end' });
        return;
      }

      markProgrammaticScroll();
      if (behavior === 'auto') {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      }
    },
    [getViewport, markProgrammaticScroll],
  );

  const debouncedScroll = useCallback(
    (
      scrollTarget: 'context' | 'tail' = 'context',
      behavior: ScrollBehavior = 'auto',
      delayMs = 150,
    ) => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (scrollTarget === 'tail') {
          scrollToTail(behavior);
        } else {
          scrollToBottom(behavior);
        }
        scrollTimeoutRef.current = null;
      }, delayMs);
    },
    [scrollToBottom, scrollToTail],
  );

  useLayoutEffect(() => {
    if (!isExpanded) return;
    const currentCount = messages.length;

    if (needsInitialScrollRef.current && currentCount > 0) {
      needsInitialScrollRef.current = false;
      prevMessageCountRef.current = currentCount;
      shouldAutoFollowRef.current = true;
      scrollToBottom('auto');
      return;
    }

    if (
      shouldAutoFollowRef.current &&
      currentCount > prevMessageCountRef.current &&
      prevMessageCountRef.current > 0
    ) {
      debouncedScroll('context', 'smooth', 150);
    }

    prevMessageCountRef.current = currentCount;
  }, [isExpanded, messages.length, scrollToBottom, debouncedScroll]);

  useEffect(() => {
    if (isExpanded) {
      needsInitialScrollRef.current = true;
      prevMessageCountRef.current = 0;
      shouldAutoFollowRef.current = true;
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded || !hasMessages) return;

    const viewport = getViewport();
    if (!viewport) return;

    const syncAutoFollow = () => {
      if (isProgrammaticScrollRef.current) return;

      const atBottom = isNearBottom(viewport);
      shouldAutoFollowRef.current = atBottom;

      if (!atBottom && scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };

    syncAutoFollow();
    viewport.addEventListener('scroll', syncAutoFollow, { passive: true });

    return () => {
      viewport.removeEventListener('scroll', syncAutoFollow);
    };
  }, [getViewport, hasMessages, isExpanded, isNearBottom]);

  useEffect(() => {
    if (!isExpanded || !hasMessages) return;

    let frameOne = 0;
    let frameTwo = 0;
    const timer = window.setTimeout(() => {
      scrollToBottom('auto');
    }, 220);

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
      window.clearTimeout(timer);
    };
  }, [hasMessages, isExpanded, scrollToBottom]);

  useEffect(() => {
    if (!isExpanded || !isAssistantActive || !shouldAutoFollowRef.current) {
      return;
    }

    debouncedScroll('tail', 'auto', 120);
  }, [isAssistantActive, isExpanded, messages, debouncedScroll]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
        programmaticScrollTimeoutRef.current = null;
      }
    };
  }, []);

  if (!isReadyForAssistant || threadRowQuery.isError) {
    return null;
  }

  if (
    pendingThreadIdRef.current &&
    threadRow?.threadId === pendingThreadIdRef.current
  ) {
    pendingThreadIdRef.current = null;
  }

  const handleSend = async (text: string, mentions: MentionRef[]) => {
    if (isSending) return false;

    let prompt = text.trim();
    if (!prompt) return false;

    if (mentions.length > 0) {
      const mentionContext = mentions
        .map(m => `[${m.type}:${m.label}](${m.href})`)
        .join(', ');
      prompt = `${prompt}\n\n[Referenced: ${mentionContext}]`;
    }

    setIsExpanded(true);
    setIsSending(true);
    shouldAutoFollowRef.current = true;

    try {
      let ensuredThreadId = threadRow?.threadId ?? null;
      if (!threadRow) {
        const ensuredThread = await ensureThread({ orgSlug, pageContext });
        ensuredThreadId = ensuredThread?.threadId ?? null;
      }
      pendingThreadIdRef.current = ensuredThreadId;
      await sendMessage({ orgSlug, pageContext, prompt });
      return true;
    } catch (error) {
      pendingThreadIdRef.current = null;
      toast.error(
        error instanceof Error ? error.message : 'Failed to send message',
      );
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    const ok = await confirmAction({
      title: `Delete ${pendingAction.entityType}`,
      description: `This will permanently delete "${pendingAction.entityLabel}" and cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await executeConfirmedAction({
        orgSlug,
        actionId: pendingAction.id,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const handleClearHistory = async () => {
    const ok = await confirmAction({
      title: 'Clear conversation',
      description: 'This will clear the conversation and start fresh.',
      confirmLabel: 'Clear',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await clearThreadHistory({ orgSlug });
      setIsExpanded(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to clear history',
      );
    }
  };

  return (
    <>
      <div className='border-border flex flex-col border-t'>
        {/* Header toggle */}
        <button
          type='button'
          onClick={() => setIsExpanded(prev => !prev)}
          className='text-muted-foreground hover:text-foreground flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors'
        >
          <span>{branding.name}</span>
          <span className='flex items-center gap-1'>
            {isAssistantActive && (
              <span className='bg-foreground/40 size-1.5 animate-pulse rounded-full' />
            )}
            {isExpanded ? (
              <ChevronsDown className='size-3' />
            ) : (
              <ChevronsUp className='size-3' />
            )}
          </span>
        </button>

        {/* Expanded messages */}
        <AnimatePresence initial={false}>
          {isExpanded && hasMessages ? (
            <motion.div
              key='messages'
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{
                opacity: 0,
                height: 0,
                transition: CHAT_PANEL_EXIT,
              }}
              transition={CHAT_PANEL_TRANSITION}
              className='relative min-w-0 overflow-hidden'
            >
              <ScrollArea
                className='h-[min(40vh,320px)] w-full min-w-0'
                viewportClassName='overscroll-contain'
                maskHeight={12}
                viewportRef={viewportRef}
              >
                <div
                  ref={contentRef}
                  className='min-w-0 space-y-2.5 overflow-x-hidden px-2 pt-1 pb-2'
                >
                  {messages.map(message => (
                    <div
                      key={`${message.role}-${message.id ?? `${message.order}-${message.stepOrder}`}`}
                      data-message-role={message.role}
                    >
                      <AssistantDockMessage message={message} />
                    </div>
                  ))}
                  <div ref={endRef} aria-hidden className='h-px' />
                </div>
              </ScrollArea>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Collapsed preview — last message */}
        <AnimatePresence initial={false}>
          {!isExpanded && hasMessages ? (
            <motion.div
              key='preview'
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{
                opacity: 0,
                height: 0,
                transition: CHAT_PANEL_EXIT,
              }}
              transition={CHAT_PANEL_TRANSITION}
              className='cursor-pointer overflow-hidden'
              onClick={() => setIsExpanded(true)}
            >
              <div className='px-2 pb-1'>
                {messages.slice(-1).map(message => (
                  <AssistantDockMessage
                    key={`${message.role}-${message.id ?? `${message.order}-${message.stepOrder}`}-preview`}
                    message={message}
                    compact
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Pending action banner */}
        {pendingAction ? (
          <div className='mx-2 mb-1 flex items-center gap-2 rounded-md border border-[#cb706f]/20 px-2 py-1'>
            <Trash2 className='size-3 text-[#cb706f]' />
            <div className='min-w-0 flex-1'>
              <div className='truncate text-[11px]'>
                {pendingAction.summary}
              </div>
            </div>
            <Button
              size='sm'
              variant='outline'
              className='h-5 text-[10px]'
              onClick={handleConfirmAction}
            >
              Confirm
            </Button>
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground'
              onClick={() => void cancelPendingAction({ orgSlug })}
            >
              <X className='size-3' />
            </button>
          </div>
        ) : null}

        {/* Error banner */}
        {threadRow?.threadStatus === 'error' && threadRow.errorMessage ? (
          <div className='mx-2 mb-1 rounded-md border border-[#cb706f]/20 px-2 py-1 text-[11px] text-[#cb706f]'>
            {threadRow.errorMessage}
          </div>
        ) : null}

        {/* Input bar */}
        <div className='px-1.5 pb-1.5'>
          <div
            className={cn(
              'border-border/60 bg-background/60 overflow-hidden rounded-lg border',
            )}
          >
            <div className='flex items-end gap-0.5'>
              <AssistantInput
                ref={inputRef}
                orgSlug={orgSlug}
                onSubmit={handleSend}
                onFocus={() => setIsExpanded(true)}
                disabled={isSending}
                className='min-h-8 flex-1 px-2 py-1.5 text-xs'
                placeholder='Ask anything...'
              />
              <div className='flex shrink-0 items-center gap-0.5 p-1'>
                {hasMessages ? (
                  <button
                    type='button'
                    onClick={() => void handleClearHistory()}
                    className='text-muted-foreground/40 hover:text-muted-foreground flex size-5 items-center justify-center rounded transition-colors'
                    aria-label='Clear conversation'
                  >
                    <Trash2 className='size-2.5' />
                  </button>
                ) : null}
                <Button
                  size='sm'
                  className='size-5 rounded p-0'
                  disabled={isSending}
                  onClick={() => inputRef.current?.submit()}
                >
                  {isSending || threadRow?.threadStatus === 'pending' ? (
                    <BarsSpinner size={10} />
                  ) : (
                    <ArrowUp className='size-2.5' />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmActionDialog />
    </>
  );
}
