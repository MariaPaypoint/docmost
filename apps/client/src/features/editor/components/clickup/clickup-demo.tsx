import React from 'react';
import { 
  Box, 
  Title, 
  Text, 
  Code, 
  Card, 
  List, 
  Container, 
  Divider, 
  Alert 
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

/**
 * Demo and documentation component for ClickUp links functionality
 */
export default function ClickUpDemo() {
  return (
    <Container my="md">
      <Title order={2} mb="md">ClickUp Links Integration</Title>

      <Alert icon={<IconInfoCircle size={16} />} title="API Key Required" color="blue" mb="lg">
        This feature requires a valid ClickUp API key set in the server environment as CLICKUP_API_KEY.
      </Alert>

      <Text mb="md">
        This integration enhances the editor by displaying ClickUp task links with status colors 
        and task names automatically.
      </Text>

      <Divider my="md" label="Features" />
      
      <List spacing="xs" mb="lg">
        <List.Item>Automatic detection of ClickUp task links</List.Item>
        <List.Item>Display of task status with color icon</List.Item>
        <List.Item>Display of task name instead of URL</List.Item>
        <List.Item>Tooltip with detailed task information</List.Item>
        <List.Item>Caching system to prevent excessive API calls</List.Item>
      </List>

      <Divider my="md" label="How to Test" />
      
      <Card withBorder p="md" radius="md" mb="md">
        <Text fw={500} mb="xs">Step 1: Configure API key</Text>
        <Text size="sm">
          Add your ClickUp API key to the server environment variables:
        </Text>
        <Code block>CLICKUP_API_KEY=your_api_key_here</Code>
      </Card>
      
      <Card withBorder p="md" radius="md" mb="md">
        <Text fw={500} mb="xs">Step 2: Paste ClickUp link</Text>
        <Text size="sm">
          In the editor, paste a ClickUp task link in this format:
        </Text>
        <Code block>https://app.clickup.com/t/abc123</Code>
      </Card>
      
      <Card withBorder p="md" radius="md" mb="md">
        <Text fw={500} mb="xs">Step 3: Link transformation</Text>
        <Text size="sm" mb="xs">
          The link will automatically transform to show:
        </Text>
        <Box 
          p="sm" 
          style={{ 
            border: '1px solid #eee', 
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Box 
            w={10} 
            h={10} 
            style={{ 
              borderRadius: '50%', 
              backgroundColor: '#4bade8',
            }} 
          />
          <Text size="sm" fw={500}>Example ClickUp Task</Text>
        </Box>
      </Card>
    </Container>
  );
}
