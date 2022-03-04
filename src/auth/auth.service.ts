import { ForbiddenException, Injectable } from '@nestjs/common';
import * as argon from 'argon2';
import { AuthDto } from './dto';
import { PrismaService } from './../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: AuthDto) {
    try {
      //generate password hash
      const hash = await argon.hash(dto.password);

      //create new user
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash,
        },
      });

      //return the jwt token
      return { access: this.signToken(user.id, user.email) };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials already exist');
        }
      }
      throw error;
    }
  }

  async signin(dto: AuthDto) {
    //find the user in db
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    //throw exception if user is not found
    if (!user) throw new ForbiddenException('Email Does Not Exist!');

    //check password validity
    const pwMatches = await argon.verify(user.hash, dto.password);

    //throw exception if password is incorrect
    if (!pwMatches) throw new ForbiddenException('Incorrect Pasword!');

    //return the jwt token
    return this.signToken(user.id, user.email);
  }

  async signToken(
    userId: number,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };
    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
      secret,
    });

    return {
      access_token: token,
    };
  }
}
