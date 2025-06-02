import React from 'react';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Anchor, Badge, Box, Card, Flex, Group, Loader, Text, Tooltip } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useClickUpTask } from './use-clickup-task';
import { ClickUpTaskManager } from './use-clickup-task';
import ClickUpTaskTooltip from './clickup-link-tooltip';

interface ClickUpTask {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
  };
  priority?: {
    priority: string;
    color: string;
  };
  dueDate?: string;
  listName?: string;
  assignees?: Array<{
    username: string;
    profilePicture?: string;
  }>;
  url: string;
}

export default function ClickUpLinkView({
  node,
  editor,
  getPos,
  extension,
  selected,
  updateAttributes,
  deleteNode
}: NodeViewProps) {
  // Use the centralized task data hook
  const taskUrl = node.attrs.href;
  const taskId = node.attrs.taskId || ClickUpTaskManager.extractTaskId(taskUrl);
  const { task, loading: isLoading, error } = useClickUpTask(taskId);

  // Use either API data or existing node attributes
  const displayName = task?.name || node.attrs.taskName || 'Unknown task';
  const statusColor = task?.status?.color || node.attrs.taskStatusColor || '#ddd';
  const statusLabel = task?.status?.status || node.attrs.taskStatus || 'Unknown status';

  // Loading view
  if (isLoading) {
    return (
      <NodeViewWrapper className="clickup-link-view">
        <Card p="xs" className="clickup-task-card" withBorder radius="sm">
          <Group justify="space-between" gap="xs">
            <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ddd' }} className="clickup-task-status" />
            <Loader size="xs" />
            <Text size="sm">Loading task...</Text>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  // Error view
  if (error) {
    return (
      <NodeViewWrapper className="clickup-link-view">
        <Card p="xs" className="clickup-task-card" withBorder radius="sm">
          <Group justify="space-between" gap="xs">
            <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff0000' }} className="clickup-task-status" />
            <Text size="sm" color="red">Error loading task</Text>
            <Anchor href={taskUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <IconExternalLink size={14} />
            </Anchor>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  // Normal view with task data
  return (
    <NodeViewWrapper className="clickup-link-view">
      <Tooltip
        label={<ClickUpTaskTooltip task={task} />}
        withArrow
        position="top"
        multiline
        style={{ width: 320 }}
      >
        <Card p="xs" className="clickup-task-card" withBorder radius="sm">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Box style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: statusColor }} className="clickup-task-status" />
              <Text size="sm" truncate>{displayName}</Text>
            </Group>
            <Anchor href={taskUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <IconExternalLink size={14} />
            </Anchor>
          </Group>
        </Card>
      </Tooltip>
    </NodeViewWrapper>
  );
}
