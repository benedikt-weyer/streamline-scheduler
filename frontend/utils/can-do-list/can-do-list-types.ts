export interface CanDoItem {
  id: string;
  content: string;
  completed: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EncryptedCanDoItem {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface CanDoList {
  items: CanDoItem[];
}