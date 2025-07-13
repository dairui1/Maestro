import type { Meta, StoryObj } from '@storybook/react'
import { MaestroButton } from './MaestroButton'

const meta = {
  title: 'Components/MaestroButton',
  component: MaestroButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['default', 'primary', 'secondary', 'success', 'warning', 'danger'],
    },
    variant: {
      control: 'select',
      options: ['solid', 'bordered', 'light', 'flat', 'faded', 'shadow', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof MaestroButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Click me',
  },
}

export const Primary: Story = {
  args: {
    label: 'Primary Button',
    color: 'primary',
  },
}

export const Large: Story = {
  args: {
    label: 'Large Button',
    size: 'lg',
    color: 'primary',
  },
}

export const Bordered: Story = {
  args: {
    label: 'Bordered Button',
    variant: 'bordered',
  },
}