import { Controller, Get, Query } from '@nestjs/common';

@Controller('user')
export class UserController {
    //Get all user 
    @Get()
    getUsers(@Query('name') name: string) {
        const users = [
            {id:1, name:'Pratik',},
            {id:2, name:'Lokeshwar'},
            {id:2, name:'Lokeshwar'}
        ];
    }
}
