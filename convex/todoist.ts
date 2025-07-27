export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  labels: string[];
  priority: number;
  due?: {
    date: string;
    string: string;
  };
  url: string;
  project_id: string;
}

export interface CreateTaskParams {
  content: string;
  description?: string;
  project_id?: string;
  due_date?: string;
  due_string?: string;
  due_datetime?: string;
  due_lang?: string;
  priority?: number;
  labels?: string[];
}

export class TodoistClient {
  constructor(private token: string) {}

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`https://api.todoist.com/rest/v2${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Todoist API error: ${response.status} ${response.statusText}`);
    }

    // Handle empty responses (like DELETE operations)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async createTask(params: CreateTaskParams): Promise<TodoistTask> {
    return this.makeRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getTasks(project_id?: string): Promise<TodoistTask[]> {
    const query = project_id ? `?project_id=${project_id}` : '';
    return this.makeRequest(`/tasks${query}`);
  }

  async getTask(id: string): Promise<TodoistTask> {
    return this.makeRequest(`/tasks/${id}`);
  }

  async updateTask(id: string, params: Partial<CreateTaskParams>): Promise<TodoistTask> {
    return this.makeRequest(`/tasks/${id}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async closeTask(id: string): Promise<void> {
    await this.makeRequest(`/tasks/${id}/close`, {
      method: 'POST',
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.makeRequest(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async getProjects() {
    return this.makeRequest('/projects');
  }
}