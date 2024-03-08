<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use DateTimeImmutable;
use Ds\Hashable;
use Symfony\Component\Uid\Ulid as SymfonyUlid;

abstract class Ulid implements Hashable
{
    private SymfonyUlid $ulid;

    final private function __construct(string $ulid)
    {
        if (!SymfonyUlid::isValid($ulid)) {
            throw new InvalidIdException($ulid);
        }

        $this->ulid = SymfonyUlid::fromString($ulid);
    }

    public static function fromString(string $ulid): static
    {
        return new static($ulid);
    }

    public static function create(?DateTimeImmutable $date = null): static
    {
        return new static(SymfonyUlid::generate($date));
    }

    public static function fromUlid(Ulid $ulid): static
    {
        return new static($ulid->toString());
    }

    public function equals(mixed $obj): bool
    {
        if (($obj instanceof self) === false) {
            return false;
        }

        return $this->toString() === $obj->toString();
    }

    public function hash(): string
    {
        return sprintf('%s.%s', static::class, $this->toString());
    }

    public function toString(): string
    {
        return $this->ulid->toBase32();
    }
}
