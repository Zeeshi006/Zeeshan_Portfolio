import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "hammad@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "••••••••" })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class TokenResponseDto {
  @ApiProperty()
  access_token!: string;
}
