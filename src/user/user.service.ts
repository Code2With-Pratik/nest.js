import { Injectable } from '@nestjs/common';
import { LoggerService } from './user.logger.js';

export class User {
    id: number;
    name: string;
    email: string;
}

@Injectable()
export class UserService {
    constructor(private readonly logger: LoggerService) {}
    private users:User[] = [
        {id:1, name: 'John Doe', email: 'john@email.com'},
        {id:2, name: 'Jane Doe', email: 'jane@email.com'},
    ];

    findAllUsers(name: string = '') {
        this.logger.log('Finding all users');
        return this.users.filter((user) =>
         user.name.toLowerCase().includes(name.toLowerCase()),
      );
    }
}
