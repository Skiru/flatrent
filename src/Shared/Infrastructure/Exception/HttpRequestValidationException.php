<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Exception;

use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Validator\ConstraintViolationListInterface;

final class HttpRequestValidationException extends RuntimeException
{
    private function __construct(string $message = '')
    {
        parent::__construct($message, Response::HTTP_BAD_REQUEST);
    }

    public static function fromError(ConstraintViolationListInterface $list): self
    {
        return new self((string) $list);
    }
}
