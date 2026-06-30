/**
 * DraftSelector.tsx
 *
 * Component for displaying and managing form drafts.
 * Shows available drafts for a form type and allows resuming or deleting them.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  useTheme,
} from '@mui/material';
import { Button } from '@ode/components/react-web';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { draftService, DraftSummary } from '../services/DraftService';
import { useOdeT } from '../i18n/useOdeT';

interface DraftSelectorProps {
  /** The form type to show drafts for */
  formType: string;
  /** Optional form version for compatibility filtering */
  formVersion?: string;
  /** Called when user selects a draft to resume */
  onResumeDraft: (draftId: string) => void;
  /** Called when user chooses to start a new form */
  onStartNew: () => void;
  /** Called when the component should be closed */
  onClose?: () => void;
  /** Whether to show as a full-screen dialog */
  fullScreen?: boolean;
}

// Container style – matched with other confirm UIs (no semi-transparent overlay)
const CONFIRM_CARD_RADIUS = 0.7;
const CONFIRM_BORDER_WIDTH = 1;

export const DraftSelector: React.FC<DraftSelectorProps> = ({
  formType,
  formVersion,
  onResumeDraft,
  onStartNew,
  onClose,
  fullScreen = false,
}) => {
  const theme = useTheme();
  const t = useOdeT();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [_cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Load drafts on component mount and when formType changes
  const loadDrafts = useCallback(() => {
    const formDrafts = draftService.getDraftsForForm(formType, formVersion);
    setDrafts(formDrafts);

    // Check for old drafts and show cleanup message
    const oldDraftCount = draftService.getOldDraftCount();
    if (oldDraftCount > 0) {
      setCleanupMessage(
        oldDraftCount === 1
          ? t(
              'draft.cleanupOldOne',
              '1 draft older than 7 days will be automatically removed.',
            )
          : t(
              'draft.cleanupOldMany',
              '{{count}} drafts older than 7 days will be automatically removed.',
              { count: oldDraftCount },
            ),
      );
    }
  }, [formType, formVersion, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDrafts();
  }, [loadDrafts]);

  const handleDeleteDraft = (draftId: string) => {
    setDraftToDelete(draftId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteDraft = () => {
    if (draftToDelete) {
      const success = draftService.deleteDraft(draftToDelete);
      if (success) {
        loadDrafts(); // Refresh the list
      }
    }
    setDeleteConfirmOpen(false);
    setDraftToDelete(null);
  };

  const formatDate = (date: Date): string =>
    date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const draftsSection =
    drafts.length > 0 ? (
      <Box
        sx={{
          width: '100%',
          mt: 1,
        }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: 0.75, textAlign: 'left' }}>
          {t('draft.recentDrafts', 'Recent drafts ({{count}})', {
            count: drafts.length,
          })}
        </Typography>
        <Box
          sx={{
            borderRadius: CONFIRM_CARD_RADIUS,
            border: `${CONFIRM_BORDER_WIDTH}px solid`,
            borderColor: 'divider',
            backgroundColor: theme.palette.background.paper,
            overflow: 'hidden',
          }}>
          {drafts.map((draft, index) => (
            <Box
              key={draft.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                borderTop:
                  index === 0 ? 'none' : `1px solid ${theme.palette.divider}`,
              }}>
              <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                <Typography
                  variant="body2"
                  color="text.primary"
                  noWrap
                  sx={{ textAlign: 'left' }}>
                  {t('draft.savedAtLine', 'Draft saved {{date}}', {
                    date: formatDate(draft.updatedAt),
                  })}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexShrink: 0,
                }}>
                <Button
                  variant="neutral"
                  size="small"
                  onPress={() => onResumeDraft(draft.id)}>
                  {t('draft.resume', 'Resume')}
                </Button>
                <IconButton
                  onClick={() => handleDeleteDraft(draft.id)}
                  size="small"
                  color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    ) : (
      <Box sx={{ textAlign: 'left', py: 2, mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('draft.none', 'No recent drafts found for this form.')}
        </Typography>
      </Box>
    );

  const content = (
    <Box
      sx={{
        minHeight: fullScreen ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}>
      {/* Header bar – match Formulus native / FormLayout (full-width, no radius, divider border) */}
      <Box
        sx={theme => ({
          flexShrink: 0,
          width: '100%',
          minHeight: 82,
          boxSizing: 'border-box',
          backgroundColor: 'background.default',
          padding: theme.spacing(2),
          paddingTop: `max(${theme.spacing(2)}, env(safe-area-inset-top, 0px))`,
          borderBottom: `1px solid ${theme.palette.divider}`,
          borderRadius: 0,
          boxShadow: 'none',
        })}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontSize: '1.125rem',
            lineHeight: 1.3,
            color: 'text.primary',
            mb: 0.5,
            textAlign: 'left',
          }}>
          {t('draft.title', 'Resume Draft or Start New')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'left' }}>
          {t('draft.formLabel', 'Form: {{formType}}', { formType })}
          {formVersion && (
            <Chip label={`v${formVersion}`} size="small" sx={{ ml: 1 }} />
          )}
        </Typography>
      </Box>

      {/* Body – scrollable content below header */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          px: fullScreen ? 2 : 0,
          py: fullScreen ? 2.5 : 2,
        }}>
        <Box sx={{ width: '100%', boxSizing: 'border-box' }}>
          {/* Start new form section – concise, left-aligned label with centered CTA */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              gutterBottom
              color="text.primary"
              sx={{ fontWeight: 600, textAlign: 'left' }}>
              {t('draft.newFormSection', 'New Form')}
            </Typography>
            <Box sx={{ textAlign: 'center', mt: 0.5 }}>
              <Button
                variant="primary"
                size="medium"
                onPress={onStartNew}
                style={{ minWidth: 180 }}>
                {t('draft.startNew', 'Start New Form')}
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Available drafts – compact list below primary action */}
          {draftsSection}

          {/* Delete confirmation dialog */}
          <Dialog
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}>
            <DialogTitle>{t('draft.delete', 'Delete Draft')}</DialogTitle>
            <DialogContent>
              <Typography>
                {t(
                  'draft.deleteConfirm',
                  'Are you sure you want to delete this draft? This action cannot be undone.',
                )}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                variant="neutral"
                onPress={() => setDeleteConfirmOpen(false)}>
                {t('draft.cancel', 'Cancel')}
              </Button>
              <Button variant="danger" onPress={confirmDeleteDraft}>
                {t('draft.delete', 'Delete')}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
    </Box>
  );

  if (fullScreen) {
    return (
      <Dialog
        open={true}
        onClose={onClose}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
            backgroundImage: 'none',
            color: 'text.primary',
            borderRadius: 0,
            margin: 0,
          },
        }}>
        <DialogContent
          sx={{
            bgcolor: 'background.default',
            p: 0,
            m: 0,
          }}>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return content;
};

export default DraftSelector;
