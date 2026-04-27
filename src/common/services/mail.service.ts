import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('smtp.host'),
      port: this.config.get('smtp.port'),
      secure: false,
      auth: {
        user: this.config.get('smtp.user'),
        pass: this.config.get('smtp.pass'),
      },
    });
  }

  async sendOtp(to: string, otp: string, name?: string): Promise<void> {
    const instituteName = this.config.get('institute.name');
    try {
      await this.transporter.sendMail({
        from: this.config.get('smtp.from'),
        to,
        subject: `${otp} is your ${instituteName} OTP`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #1a237e;">${instituteName}</h2>
            <p>Hi ${name || 'there'},</p>
            <p>Your One-Time Password (OTP) for login is:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a237e;">${otp}</span>
            </div>
            <p>This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">If you did not request this OTP, please ignore this email.</p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error);
      // Don't throw – OTP still works without email in dev
    }
  }

  async sendWelcome(to: string, name: string, temporaryPassword?: string): Promise<void> {
    const instituteName = this.config.get('institute.name');
    try {
      await this.transporter.sendMail({
        from: this.config.get('smtp.from'),
        to,
        subject: `Welcome to ${instituteName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #1a237e;">${instituteName}</h2>
            <p>Dear ${name},</p>
            <p>Welcome! Your account has been created successfully.</p>
            ${temporaryPassword ? `
              <p>Your temporary password is: <strong>${temporaryPassword}</strong></p>
              <p>Please change your password after first login.</p>
            ` : ''}
            <p>Download the ${instituteName} app to get started.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}`, error);
    }
  }
}
