import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError, isValidationError } from '@/lib/api-client'

import { useCountries } from '../hooks/use-countries'
import { useRegister } from '../hooks/useRegister'
import { mapApiFieldErrors } from '@/lib/field-errors'

import { PhoneCodeCombobox } from './phone-code-combobox'

// Radix Select tidak menerima value ''; sentinel untuk "tidak memilih negara".
const NO_COUNTRY = 'none'

const PHONE_TOTAL_MIN = 7
const PHONE_TOTAL_MAX = 15
const NATIONAL_MAX = 15

/** Ambil digit saja dari dial code backend (`62`, `+62`, `(+62)` → `62`). */
function toDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Region subtag dari locale browser (`id-ID` → `ID`); null bila tak ada (SSR-safe). */
function browserRegion(): string | null {
  if (typeof navigator === 'undefined') return null
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const locale of languages) {
    const match = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})(?:-|$)/i.exec(locale)
    if (match) return match[1].toUpperCase()
  }
  return null
}

interface DialOption {
  iso2: string
  name: string
  dial: string
  emoji?: string | null
}

interface PhoneValue {
  dial: string
  national: string
}

interface PhoneInputProps {
  value: PhoneValue
  onChange: (value: PhoneValue) => void
  onBlur: () => void
  name: string
  options: DialOption[]
}

/** Komposit dial-code + nomor nasional; label/pesan diikat ke input via useFormField. */
function PhoneInput({ value, onChange, onBlur, name, options }: PhoneInputProps) {
  const { t } = useTranslation()
  const { formItemId, formMessageId, error } = useFormField()

  return (
    <InputGroup>
      <PhoneCodeCombobox
        options={options}
        value={value.dial}
        onChange={(dial) => onChange({ ...value, dial: toDigits(dial) })}
        placeholder={t('auth:register.phoneCodePlaceholder')}
        searchPlaceholder={t('auth:register.phoneCodeSearch')}
        emptyLabel={t('auth:register.phoneCodeEmpty')}
        invalid={error ? true : undefined}
        describedBy={error ? formMessageId : undefined}
      />
      <InputGroupInput
        id={formItemId}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={NATIONAL_MAX}
        placeholder={t('auth:register.phonePlaceholder')}
        value={value.national}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? formMessageId : undefined}
        onChange={(event) =>
          onChange({ ...value, national: toDigits(event.target.value).slice(0, NATIONAL_MAX) })
        }
      />
    </InputGroup>
  )
}

export function RegisterForm() {
  const { t } = useTranslation()
  const register = useRegister()
  const countriesQuery = useCountries()
  const countries = useMemo(() => countriesQuery.data?.items ?? [], [countriesQuery.data])

  // Opsi dial unik (satu dial code bisa dipakai banyak negara) + urut dial numerik.
  const dialOptions = useMemo<DialOption[]>(() => {
    const byDial = new Map<string, DialOption>()
    for (const country of countries) {
      const dial = toDigits(country.phoneCode)
      // Wajib digit non-nol di depan; backend hanya terima /^\+[1-9]\d{6,14}$/.
      if (!/^[1-9]\d*$/.test(dial) || byDial.has(dial)) continue
      byDial.set(dial, { iso2: country.iso2, name: country.name, dial, emoji: country.emoji })
    }
    return [...byDial.values()].sort(
      (a, b) => Number(a.dial) - Number(b.dial) || a.name.localeCompare(b.name),
    )
  }, [countries])

  const registerSchema = useMemo(
    () =>
      z
        .object({
          fullName: z
            .string()
            .trim()
            .min(1, t('validation:fullNameRequired'))
            .max(100, t('validation:fullNameMax', { count: 100 })),
          email: z
            .string()
            .trim()
            .min(1, t('validation:emailRequired'))
            .max(255, t('validation:emailMax', { count: 255 }))
            .email(t('validation:emailInvalid')),
          password: z
            .string()
            .min(8, t('validation:passwordMin', { count: 8 }))
            .max(128, t('validation:passwordMax', { count: 128 })),
          confirmPassword: z.string(),
          phone: z.object({
            dial: z.string(),
            national: z.string(),
          }),
          countryId: z.string().optional(),
          organization: z.boolean(),
          organizationName: z
            .string()
            .trim()
            .max(200, t('validation:organizationNameMax', { count: 200 }))
            .optional(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('validation:passwordMismatch'),
          path: ['confirmPassword'],
        })
        .refine((data) => !data.organization || (data.organizationName ?? '').length > 0, {
          message: t('validation:organizationNameRequired'),
          path: ['organizationName'],
        })
        .superRefine((data, ctx) => {
          const national = toDigits(data.phone.national).replace(/^0+/, '')
          if (!national) return // kosong = opsional
          const dial = toDigits(data.phone.dial)
          if (!dial) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['phone'],
              message: t('validation:phoneCodeRequired'),
            })
            return
          }
          const total = dial.length + national.length
          if (total < PHONE_TOTAL_MIN || total > PHONE_TOTAL_MAX) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['phone'],
              message: t('validation:phoneInvalid'),
            })
          }
        }),
    [t],
  )

  type RegisterFormValues = z.infer<typeof registerSchema>

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: { dial: '', national: '' },
      countryId: '',
      organization: false,
      organizationName: '',
    },
  })

  const error = register.error

  // Default dial dari region locale browser; hanya sekali, tak pernah menimpa pilihan user.
  const defaultDialApplied = useRef(false)
  useEffect(() => {
    if (defaultDialApplied.current || dialOptions.length === 0) return
    if (form.getValues('phone.dial')) {
      defaultDialApplied.current = true
      return
    }
    const region = browserRegion()
    if (!region) return
    const match = countries.find((country) => country.iso2.toUpperCase() === region)
    const dial = toDigits(match?.phoneCode)
    if (!/^[1-9]\d*$/.test(dial)) return
    form.setValue('phone.dial', dial, { shouldDirty: false })
    defaultDialApplied.current = true
  }, [countries, dialOptions, form])

  // 422 -> tampil per-field via setError; tanpa toast.
  useEffect(() => {
    if (!isValidationError(error)) return
    form.clearErrors()
    for (const [field, message] of Object.entries(mapApiFieldErrors(error))) {
      form.setError(field as FieldPath<RegisterFormValues>, { type: 'server', message })
    }
  }, [error, form])

  // Banner hanya untuk 409 (email sudah terdaftar); 422 tampil per-field.
  const globalMessage =
    error instanceof ApiError && error.statusCode === 409 ? error.message : null

  function onSubmit(values: RegisterFormValues) {
    const national = toDigits(values.phone.national).replace(/^0+/, '')
    const dial = toDigits(values.phone.dial)
    const phone = national && dial ? `+${dial}${national}` : undefined

    register.mutate({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      phone,
      countryId: values.countryId || undefined,
      organizationName:
        values.organization && values.organizationName ? values.organizationName : undefined,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {globalMessage && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {globalMessage}
          </p>
        )}

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.fullName')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.password')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.confirmPassword')}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.phoneNumber')}</FormLabel>
              <PhoneInput
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                options={dialOptions}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="countryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth:register.country')}</FormLabel>
              <Select
                value={field.value || NO_COUNTRY}
                onValueChange={(value) => field.onChange(value === NO_COUNTRY ? '' : value)}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('auth:register.countryPlaceholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_COUNTRY}>{t('auth:register.countryNone')}</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.id} value={country.iso2}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t('auth:register.organization')}</FormLabel>
                <p className="text-xs text-muted-foreground">
                  {t('auth:register.organizationHint')}
                </p>
              </div>
            </FormItem>
          )}
        />

        {form.watch('organization') && (
          <FormField
            control={form.control}
            name="organizationName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth:register.organizationName')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="organization"
                    maxLength={200}
                    placeholder={t('auth:register.organizationNamePlaceholder')}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full" disabled={register.isPending}>
          <UserPlus data-icon="inline-start" className="size-4" />
          {register.isPending ? t('common:actions.loading') : t('auth:register.submit')}
        </Button>
      </form>
    </Form>
  )
}
