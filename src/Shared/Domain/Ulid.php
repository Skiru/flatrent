<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use DateTimeImmutable;
use Symfony\Component\Uid\Ulid as SymfonyUlid;

abstract class Ulid
{
    private SymfonyUlid $ulid;

    final private function __construct(string $ulid)
    {
        if (!SymfonyUlid::isValid($ulid)) {
            throw new InvalidIdException($ulid);
        }

        $this->ulid = SymfonyUlid::fromString($ulid);
    }

    public static function create(?DateTimeImmutable $date = null): static
    {
        return new static(SymfonyUlid::generate($date));
    }

    public static function fromUlid(Ulid $ulid): static
    {
        return new static($ulid->toString());
    }

    public function equals(Ulid $ulid): bool
    {
        return $this->toString() === $ulid->toString();
    }

    public function toString(): string
    {
        return $this->ulid->toBase32();
    }
}
