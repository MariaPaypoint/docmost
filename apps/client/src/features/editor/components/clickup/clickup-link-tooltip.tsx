import React from 'react';
import { Card, Text, Group, Badge, Flex } from '@mantine/core';
import { IconCalendarTime, IconListCheck, IconUser } from '@tabler/icons-react';

interface ClickUpTaskTooltipProps {
  task: {
    name: string;
    status: {
      status: string;
      color: string;
    };
    dueDate?: string;
    assignees?: Array<{
      username: string;
      profilePicture?: string;
    }>;
    priority?: {
      priority: string;
      color: string;
    };
    listName?: string;
  };
}

/**
 * Enhanced tooltip component for ClickUp tasks
 * Displays detailed task information on hover
 */
export default function ClickUpTaskTooltip({ task }: ClickUpTaskTooltipProps) {
  return (
    <Card shadow="sm" padding="sm" radius="md" withBorder>
      <Text fw={500} size="sm" truncate>
        {task.name}
      </Text>
      
      <Group mt={5} mb={5}>
        <Badge 
          color={task.status.color} 
          variant="light"
          size="sm"
        >
          {task.status.status}
        </Badge>
        
        {task.priority && (
          <Badge 
            color={task.priority.color}
            variant="outline" 
            size="sm"
          >
            {task.priority.priority}
          </Badge>
        )}
      </Group>
      
      {task.listName && (
        <Flex align="center" gap={5} mt={5}>
          <IconListCheck size={14} />
          <Text size="xs" color="dimmed">
            {task.listName}
          </Text>
        </Flex>
      )}
      
      {task.dueDate && (
        <Flex align="center" gap={5} mt={5}>
          <IconCalendarTime size={14} />
          <Text size="xs" color="dimmed">
            {new Date(task.dueDate).toLocaleDateString()}
          </Text>
        </Flex>
      )}
      
      {task.assignees && task.assignees.length > 0 && (
        <Flex align="center" gap={5} mt={5}>
          <IconUser size={14} />
          <Text size="xs" color="dimmed">
            {task.assignees.map(a => a.username).join(', ')}
          </Text>
        </Flex>
      )}
    </Card>
  );
}
