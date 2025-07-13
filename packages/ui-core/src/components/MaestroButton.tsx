import { Button, ButtonProps } from '@heroui/react'

export interface MaestroButtonProps extends ButtonProps {
  label: string
}

export const MaestroButton = ({ label, ...props }: MaestroButtonProps) => {
  return <Button {...props}>{label}</Button>
}