import React, { useEffect, useState } from 'react';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Anchor,
  Box,
  Card,
  Flex,
  Loader,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { ClickUpApi } from './clickup-api';
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
  const [task, setTask] = useState<ClickUpTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const url = node.attrs.href;
  const taskId = node.attrs.taskId || ClickUpApi.extractTaskId(url);

  useEffect(() => {
    // If no taskId is found, mark as error
    if (!taskId) {
      setLoading(false);
      setError('Недопустимый URL задачи ClickUp');
      return;
    }

    // Если у нас уже есть кэшированные данные в атрибутах, используем их сразу
    if (node.attrs.taskName && node.attrs.taskStatusColor) {
      setLoading(false);
      return;
    }
    
    // Fetch task data from API
    ClickUpApi.getTask(taskId)
      .then((data) => {
        setTask(data);
      })
      .catch((err) => {
        console.error('Error fetching ClickUp task:', err);
        setError('Ошибка получения данных задачи');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [taskId]);

  // Вид при загрузке
  if (loading) {
    return (
      <NodeViewWrapper className="clickup-link-view">
        <Card withBorder padding="xs" radius="md" className="clickup-task-card">
          <Flex align="center" gap="xs">
            <Box w={12} h={12} style={{ borderRadius: '50%', backgroundColor: '#ddd' }} className="clickup-task-status" />
            <Loader size="xs" />
            <Text size="sm">Загрузка задачи...</Text>
          </Flex>
        </Card>
      </NodeViewWrapper>
    );
  }

  // Вид при ошибке
  if (error) {
    return (
      <NodeViewWrapper className="clickup-link-view">
        <Tooltip label={error}>
          <Anchor href={url} target="_blank" rel="noopener noreferrer" className="clickup-link-error">
            {url}
          </Anchor>
        </Tooltip>
      </NodeViewWrapper>
    );
  }

  // Используем кэшированные данные из атрибутов ноды или данные из API-запроса
  const taskName = node.attrs.taskName || (task?.name || 'Неизвестная задача');
  const statusColor = node.attrs.taskStatusColor || (task?.status?.color || '#ddd');
  const statusLabel = node.attrs.taskStatus || (task?.status?.status || 'Статус неизвестен');
  
  return (
    <NodeViewWrapper className="clickup-link-view">
      <Tooltip
        label={task ? <ClickUpTaskTooltip task={task} /> : `Статус: ${statusLabel}`}
        position="bottom"
        withArrow
        transitionProps={{ transition: 'pop' }}
      >
        <Card 
          withBorder 
          padding="xs" 
          radius="md" 
          className="clickup-task-card"
        >
          <Flex align="center" gap="xs">
            <Box 
              w={12} 
              h={12} 
              className="clickup-task-status" 
              style={{ backgroundColor: statusColor }} 
            />
            <Text fw={500} truncate>
              {taskName}
            </Text>
            
            <Tooltip label="Открыть в ClickUp">
              <Anchor 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="clickup-external-link"
              >
                <IconExternalLink size={14} style={{ marginLeft: 4 }} />
              </Anchor>
            </Tooltip>
          </Flex>
        </Card>
      </Tooltip>
    </NodeViewWrapper>
  );
}
