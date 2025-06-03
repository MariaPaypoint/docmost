import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

@Injectable()
export class ClickUpService {
  private readonly logger = new Logger(ClickUpService.name);
  private readonly apiBaseUrl = 'https://api.clickup.com/api/v2';
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    // Get API key from environment variables
    this.apiKey = this.configService.get<string>('CLICKUP_API_KEY');
    
    // Check if API key is available during initialization
    if (!this.apiKey) {
      this.logger.warn('WARNING: CLICKUP_API_KEY is not configured in environment variables');
    } else {
      this.logger.log('ClickUp API key configured successfully (masked): ' + 
                    this.apiKey.substring(0, 4) + '***' + this.apiKey.substring(this.apiKey.length - 4));
    }
  }

  /**
   * Get task details from ClickUp API
   * 
   * @param taskId - ClickUp task ID
   * @returns Task data with name, status, and other details
   */
  async getTaskDetails(taskId: string) {
    this.logger.log(`Received request for ClickUp task: ${taskId}`);
    try {
      // Check if API key is configured
      if (!this.apiKey) {
        this.logger.error('ClickUp API key is not configured in environment variables');
        throw new HttpException(
          'ClickUp API key not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      this.logger.log(`Sending API request for task: ${taskId}`);
      try {
        // Fetch task data from ClickUp API
        const url = `${this.apiBaseUrl}/task/${taskId}`;
        this.logger.debug(`Request URL: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            Authorization: this.apiKey,
          },
          timeout: 10000, // 10 seconds timeout
        });

        this.logger.log(`Received response from ClickUp API: ${JSON.stringify(response.data, null, 2)}`);
        //this.logger.log(`Received response from ClickUp API`);

        const data = response.data;
        
        // Return simplified task data relevant for UI rendering
        const result = {
          id: data.id,
          name: data.name,
          status: {
            status: data.status.status,
            color: data.status.color,
          },
          priority: data.priority ? {
            priority: data.priority.name,
            color: data.priority.color,
          } : null,
          dueDate: data.due_date,
          listName: data.list ? data.list.name : null,
          custom_item_id: data.custom_item_id,
          assignees: data.assignees ? data.assignees.map((assignee: any) => ({
            username: assignee.username,
            profilePicture: assignee.profilePicture,
          })) : [],
          url: data.url,
        };
        this.logger.log(`Task details result: ${JSON.stringify(result, null, 2)}`);
        return result;
      } catch (error: any) {
        this.logger.error(`Error fetching task ${taskId}: ${error.message}`);
        throw new HttpException(
          'Error fetching task from ClickUp',
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      this.logger.error(`Unexpected error fetching task ${taskId}: ${error.message}`);
      throw new HttpException(
        'Error processing ClickUp task data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
