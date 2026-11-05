import { Controller, Get, Query, Param,Post,Put, Body } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserService } from './user.service.js';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}
    //Get all user 
    @Get()
    getUsers(@Query('name') name: string) {
       return this.userService.findAllUsers(name);
    }

    @Get(':id')
    getUserById(@Param('id') id: string) {
        return {id, name: 'Josh Doe'};
    }

    @Post()
    createUser(@Body() createUserDto: CreateUserDto ) {
        return {data: createUserDto, message: 'User created successfully'};
    }

    @Put(':id')
    updateUser(@Param('id') id:string, @Body() updateUserDto: UpdateUserDto ) {
       return {
        data: { id, ...updateUserDto},
        message: 'User updated successfully',
       };
   }
}